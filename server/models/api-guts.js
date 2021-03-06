var path = require('path');
var config = require(path.join(__dirname, '../', '../', 'config'));
var log = require(path.join(__dirname, '../', '../', 'log'));
var http = require('https')

var api = {}

api.general_proxy = function general_proxy(req,res){
    var options = {
      host: req.body.proxyRequest.host,
      path: req.body.proxyRequest.path,
      headers: req.body.proxyRequest.headers,
      method: req.body.proxyRequest.method
    };
    var proxyRequest = http.request(options, function callback(proxyResponse){
        var str = ''
        proxyResponse.on('data', function (chunk) {
            str += chunk;
        })
        proxyResponse.on('end', function () {
            res.status(200).json(str)
            responseObject = JSON.parse(str)
            log.debug({"proxyResponse":{"headers":proxyResponse.headers,"payload":responseObject}})
            str = api.parse_general_response(responseObject, req.body['parser'])
            api.send_ifttt_post(req.body.event,req.body.ifttt_key,{"value1":str},res)
        })
    })
    log.debug({"proxyRequest":{"options":options,"payload":req.body.proxyRequest.payload}})
    if(req.body.proxyRequest.payload!=undefined){
        proxyRequest.write(req.body.proxyRequest.payload)
    }
    proxyRequest.end();
}

api.parse_general_response = function parse_general_response(object, parser){
    outputString = ''
    if (parser != undefined){
        log.debug('PARSER: '+JSON.stringify(parser))
        for (word in parser){
            objectWord = object
            thisWord = parser[word]
            while (thisWord.length > 0){
                objectWord = objectWord[thisWord[0]]
                log.debug('OBJECT: '+JSON.stringify(objectWord))
                thisWord.splice(0,1)
            }
            outputString += objectWord + ' '
        }
        log.debug('OUTPUT STRING: '+outputString)
        return outputString
    }
    else{
        return object    
    }
}

api.respond_with_trains = function respond_with_trains(req, res){
    var options = {
      host: 'api.wmata.com',
      path: '/StationPrediction.svc/json/GetPrediction/'+req.body.station,
      headers: {"api_key":config.wmata_api_key,"Content-Type":"application/json"},
      method: 'GET'
    };

    var request = http.request(options, function callback(response){
        var str = ''
        response.on('data', function (chunk) {
            str += chunk;
        })
        response.on('end', function () {
            log.debug({"outboundResponse":JSON.parse(str)})
            res.status(200).json(str)
            str = api.parse_wmata_response(req, res, str)
        })
    })
    request.end();
    log.debug({"outboundRequest":{"options":options}})
}

api.send_ifttt_post = function send_ifttt_post(maker_event,ifttt_key,payload,res){
    var options = {
      host: 'maker.ifttt.com',
      path: '/trigger/'+maker_event+'/with/key/'+ifttt_key,
      headers: {"Content-Type":"application/json"},
      method: 'POST'
    };

    var iftttPost = http.request(options, function callback(response){
        var str = ''
        response.on('data', function (chunk) {
            str += chunk;
        })
        response.on('end', function () {
            log.info({"outboundResponse":str})
        })
    })
    iftttPost.write(JSON.stringify(payload))
    iftttPost.end()
    log.info({"outboundRequest":{"maker_event":maker_event, "ifttt_key":ifttt_key}})
    log.debug({"outboundRequest":{"options":options,"payload":payload}})
}

api.parse_wmata_response = function parse_wmata_response(req, res, str){
    outputString = ''
    responseObject = JSON.parse(str)
    outputObject = {}
    for (i in responseObject.Trains){
        train = responseObject.Trains[i]

        if (outputObject[train['Destination']] == undefined)  {
            outputObject[train['Destination']] = []
        }
        outputObject[train['Destination']].push(train['Min'])
    }

    log.debug(outputObject)
    for (i in outputObject){
        outString = i
        for (trainTime in outputObject[i]){
            outString += ' ' + outputObject[i][trainTime]
        }
        api.send_ifttt_post(req.body.event,req.body.ifttt_key,{"value1":outString})
    }
    return outputString
}


module.exports = api