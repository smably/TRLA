var config     = require('./config');

var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');
var recaptcha  = require('express-recaptcha');
var validator  = require('validator');
var template   = require('es6-template-strings');
var Slack      = require('node-slack');
var mailgun    = require('mailgun-js')({ apiKey: config.mailgun.api_key, domain: config.mailgun.domain });

app.use(express.static('static'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

recaptcha.init(config.recaptcha.site_key, config.recaptcha.secret_key);
var slack = new Slack(config.slack.hook_url);

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
    if (!req.body.firstname) {
        error(res, 'Error: first name is required.');
        return;
    }

    if (!req.body.lastname) {
        error(res, 'Error: last name is required.');
        return;
    }

    if (!req.body.email) {
        error(res, 'Error: email is required.');
        return;
    }

    if (!req.body.postalcode) {
        error(res, 'Error: postal code is required.');
        return;
    }

    if (!req.body.message) {
        error(res, 'Error: message is required.');
        return;
    }

    if (!validator.isEmail(req.body.email)) {
        error(res, 'Error: email is invalid.');
    }

    if (!/^[a-zA-Z]\d[a-zA-Z]\s*\d[a-zA-Z]\d$/.test(req.body.postalcode)) {
        error(res, 'Error: postal code is invalid.');
    }

    var data = {
        from: template('${firstName} ${lastName} <${email}>', { firstName: req.body.firstname, lastName: req.body.lastname, email: req.body.email }),
        to: 'test@mail.relieflinealliance.ca',
        subject: 'I support the relief line',
        text: req.body.message
    };

    mailgun.messages().send(data, function (error, body) {
        if (error) {
            res.json({ message: 'Error: could not send message.' });
        } else {
            console.log("Message sent. Got response from mailgun:\n", body);

            var user = {
                subscribed: !!req.body.newsletter,
                address: req.body.email,
                name: req.body.firstname + " " + req.body.lastname,
                vars: {
                    postalCode: req.body.postalcode,
                    lawnsign: !!req.body.lawnsign
                }
            };

            mailgun.lists('newsletter@mail.relieflinealliance.ca').members().create(user, function (err, data) {
                if (err) {
                    console.log(err, data);
                }
            });

            slack.send({ text: template('*From:* ${from}\n*Message:* ${text}', data) });

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
