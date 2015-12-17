var config     = require('./config');

var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');
var recaptcha  = require('express-recaptcha');
var validator  = require('validator');
var template   = require('es6-template-strings');
var mailgun    = require('mailgun-js')({ apiKey: config.api_key, domain: config.domain });

app.use(express.static('static'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

recaptcha.init(config.recaptcha.site_key, config.recaptcha.secret_key);

var port = process.env.PORT || 8090;

app.post('/message/send', recaptcha.middleware.verify, function(req, res) {
    if (!req.recaptcha.error) {
        sendEmail(req, res);
    } else {
        res.status(403);
        res.json({ message: template('Error: CAPTCHA validation failed (${err}).', { err: req.recaptcha.error }) });
    }
});

function sendEmail(req, res) {
    if (!req.body.name) {
        error(res, 'Error: name is required.');
        return;
    }

    if (!req.body.email) {
        error(res, 'Error: email is required.');
        return;
    }

    if (!req.body.message) {
        error(res, 'Error: message is required.');
        return;
    }

    if (!validator.isEmail(res.body.email)) {
        error(res, 'Error: email is invalid.');
    }

    var message = {
        name: req.body.name,
        email: req.body.email,
        body: req.body.message
    };

    var data = {
        from: template('${name} <${email}>', { name: message.name, email: message.email }),
        to: 'test@mail.relieflinealliance.ca',
        subject: 'I support the relief line',
        text: message.body
    };

    mailgun.messages().send(data, function (error, body) {
        if (error) {
            res.json({ message: 'Error: could not send message.' });
        } else {
            console.log("Message sent. Got response from mailgun:\n", body);
            res.json({ message: 'Message sent!' });
        }
    });
}

function error(res, msg) {
    res.status(422);
    res.json({ message: msg});
}

app.listen(port);
console.log('Listening on port ' + port);
