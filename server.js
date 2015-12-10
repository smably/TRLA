var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');

var config = require('./config');
var mailgun    = require('mailgun-js')({apiKey: config.api_key, domain: config.domain});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

var port = process.env.PORT || 8090;

var router = express.Router();

router.use(function(req, res, next) {
    console.log('Request received...');
    next();
});

router.get('/', function(req, res) {
    res.json({ message: 'Try POSTing to /message/send' });
});

router.route('/message/send').post(function(req, res) {
    if (req.body.name && req.body.email && req.body.message) {
        var message = {
            name: req.body.name,
            email: req.body.email,
            body: req.body.message
        };

        var data = {
            from: message.name + ' <' + message.email + '>', // WOW, VERY SECURITY
            to: 'test@mail.relieflinealliance.ca',
            subject: 'I support the relief line',
            text: message.body
        };

        mailgun.messages().send(data, function (error, body) {
            // TODO handle error
            console.log("Message sent. Got response from mailgun:\n", body);
            res.json({ message: 'Message sent!' });
        });
    } else {
        console.log('Error sending message!');
        res.json({ message: 'Error: name, email, and message are required.'});
    }
});

app.use('/api', router);

app.listen(port);
console.log('Listening on port ' + port);
