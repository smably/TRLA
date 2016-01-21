var config     = require('./config');

var express    = require('express');
var app        = express();
var bodyParser = require('body-parser');
var recaptcha  = require('express-recaptcha');
var validator  = require('validator');
var template   = require('es6-template-strings');
var Slack      = require('slack-node');
var mailgun    = require('mailgun-js')({ apiKey: config.mailgun.api_key, domain: config.mailgun.domain });

app.use(express.static('static'));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

recaptcha.init(config.recaptcha.site_key, config.recaptcha.secret_key);
var slack = new Slack();
slack.setWebhook(config.slack.hook_url);

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
        return;
    }

    if (!/^[a-zA-Z]\d[a-zA-Z]\s*\d[a-zA-Z]\d$/.test(req.body.postalcode)) {
        error(res, 'Error: postal code is invalid.');
        return;
    }

    if (req.body.lawnsign && !(req.body.address && req.body.city)) {
        error(res, "Error: address and city are required to request a lawn sign.");
        return;
    }

    /* ================================================= */

    var vars = {
        postalCode: req.body.postalcode,
        lawnsign: !!req.body.lawnsign
    };

    if (vars.lawnsign) {
        vars.address = req.body.address;
        vars.city = req.body.city;
    }

    var user = {
        subscribed: !!req.body.newsletter,
        address: req.body.email,
        name: req.body.firstname + " " + req.body.lastname,
        vars: vars
    };

    var header = "Dear %recipient_name%,\n\n";
    var footer = "\n\nSincerely,\n\n" + user.name + "\n" + req.body.postalcode;         // TODO template

    var mailData = {
        from: template('${firstName} ${lastName} <${email}>', { firstName: req.body.firstname, lastName: req.body.lastname, email: req.body.email }),
        to: 'test@mail.relieflinealliance.ca',
        subject: 'I support the relief line',
        text: header + req.body.message + footer
    };

    /* ================================================= */

    mailgun.lists('supporters@mail.relieflinealliance.ca').members().create(user, function (err, data) {
        if (err) {
            error(res, 'Error: you have already sent a message from this email address.');
        } else {
            mailgun.messages().send(mailData, function (err, body) {
                if (err) {
                    error(res, 'Error: could not send message.');
                    console.log("Got failure from Mailgun:", err);
                } else {
                    console.log("Message sent. Got response from mailgun:\n", body);

                    slack.webhook({ text: template('*From:* ${from}\n*Message:* ${text}\n*Newsletter:* ${newsletter}\n*Lawn sign:* ${lawnsign}', {
                        from: mailData.from,
                        text: mailData.text,
                        newsletter: user.subscribed ? "yes" : "no",
                        lawnsign: vars.lawnsign ? vars.address + ", " + vars.city : "no"
                    }) });

                    res.json({ message: 'Message sent!' });
                }
            });
        }
    });
}

function error(res, msg) {
    res.status(422);
    res.json({ message: msg});
}

app.listen(port);
console.log('Listening on port ' + port);
