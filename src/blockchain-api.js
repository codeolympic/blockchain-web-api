const express = require('express');

//const spawn = require('child_process').spawn;
const spawn = require('await-spawn');

const app = express();

const fetch = require("node-fetch");

app.use(express.static('public'));

app.use(express.urlencoded({ extended: true }));

app.use(express.json());

// Session 
const Session = require('./session');
const currentSession = new Session(app);
currentSession.initializeSession();


var path = require('path');

// To keep using html files with ejs engine.
app.engine('html', require('ejs').renderFile);
app.set('view engine', 'html');
app.set('views', path.join(__dirname, 'views'));

var fs = require('fs');

var wallets = [];
var transactionData = [];


async function readWallet() {
    fs.readFile('.//public/walletData.json', 'utf8', async (err, data) => {
        if (err) {
            throw err;
        }
        wallets = await JSON.parse(data);
    });

    fs.readFile('.//public/transactionData.json', 'utf8', async (err, data) => {
        if (err) {
            throw err;
        }
        transactionData = await JSON.parse(data);
    });
}


readWallet();
//readDB();

// IO method should be changed to get a better performance.
async function refreshCurrentUser(publicName, session) {
    if (publicName === "null") {
        session.isUserSpecified = false;
        session.currentUser = 'undefined';
    }
    else {
        await assignUser(publicName, session);
    }
}

async function assignUser(publicName, session) {
    for (var i = 0; i < wallets.users.length; i++) {
        if (wallets.users[i].name === publicName) {
            session.isUserSpecified = true;
            session.currentUser = wallets.users[i];
            return;
        }
    }
}

app.use((req, res, next) => {
    console.log("New Request ");
    console.log('Host name: ' + req.hostname);
    console.log('Request url: ' + req.path);
    console.log('Request http method: ' + req.method);
    console.log(req.session);
    console.log('--------------------------------------');
    next();
})


//Home page

app.get('/', (req, res) => {
    readWallet();
    var isUserSpecified = currentSession.getUserStatus(req.session);
    var currentUser = currentSession.getCurrentUser(req.session);

    if (isUserSpecified === true) {
        res.render("index", { title: "Home", isUserSpecified: true, user: currentUser, alert: false });
    }
    else if (isUserSpecified === undefined || isUserSpecified === false) {
        refreshCurrentUser("null", req.session);
        res.render("index", { title: "Home", isUserSpecified: false, user: "undefined", alert: false });
    }
})

app.post('/', (req, res) => {
    const publicName = req.body.wallet.publicName;
    const publicPass = req.body.wallet.publicPass;
    // Handle privatekey!

    refreshCurrentUser(publicName, req.session);

    var isUserSpecified = currentSession.getUserStatus(req.session);
    var currentUser = currentSession.getCurrentUser(req.session);

    if (isUserSpecified === false) {
        return res.render("index", { title: "Home", isUserSpecified, user: currentUser, alert: true });
    }
    else {
        return res.redirect('/');
    }
})

app.get('/exit', (req, res) => {
    currentSession.destroy(req.session);
    return res.redirect('/');
})

// Users and wallet operations.
app.get('/users', (req, res) => {
    var isUserSpecified = currentSession.getUserStatus(req.session);
    var currentUser = currentSession.getCurrentUser(req.session);

    readWallet();
    res.render("users", { title: "Users", users: wallets.users, isUserSpecified, user: currentUser });
})

app.get('/createWallet', (req, res) => {
    var currentUser = currentSession.getCurrentUser(req.session);
    res.render("createWallet", { title: "Create wallet", isUserSpecified: false, user: currentUser });
})

app.post('/createWallet', async (req, res) => {
    const publicName = req.body.createWallet.publicName;
    const publicPass = req.body.createWallet.publicPass;
    const python = await spawn('python', ['api-scripts/createWallet.py', publicName, publicPass]);
    /* python.stdout.on('data', function (data) {
         console.log(data.toString());
     })*/
    // insertToDB(publicName, publicPass);

    console.log("New wallet created-> " + publicName);

    await readWallet();
    await refreshCurrentUser(publicName, req.session);

    return res.redirect('/');
})

app.get('/users/:id', (req, res) => {
    const id = req.params.id;
    wallets.users.find((user) => {
        if (user.name === id) {
            return res.render('users', { title: id, users: [], user: user, isUserSpecified: currentSession.getUserStatus(req.session) });
        }
    });
})

app.get('/users/:id/delete', async (req, res) => {
    const id = req.params.id;
    const python = await spawn('python', ['api-scripts/deleteWallet.py', id]);
    console.log("Wallet " + id + " is deleted.");
    // deleteUserFromDB(id);
    return res.redirect('/users');
})


//Transactions
app.get('/transactions', (req, res) => {
    var isUserSpecified = currentSession.getUserStatus(req.session);
    var currentUser = currentSession.getCurrentUser(req.session);

    if (isUserSpecified) {
        readWallet();
        refreshCurrentUser(currentUser.name, req.session);
        res.render("transactions", { title: "Transactions", isUserSpecified, user: currentUser, transactions: transactionData.transactions });
    }
    else {
        res.redirect("/");
    }
})

app.post('/transactions', async (req, res) => {
    const publicAddress = req.body.transactions.publicAddress;
    const coinAmount = req.body.transactions.coinAmount;

    var currentUser = currentSession.getCurrentUser(req.session);

    const python = await spawn('python', ['api-scripts/handleTransaction.py', currentUser.name, publicAddress, coinAmount]);
    /* python.stdout.on('data', function (data) {
        console.log(data.toString());
    })*/
    return res.redirect('/transactions');
})

// If server receives an undefined request, it will return a 404 error.
app.use('/', (req, res) => {
    return res.status(404).render("404", { title: "404", user: "undefined", isUserSpecified: false });
})

app.listen(8000, () => {
    console.log('Listening')
});