const fs = require("fs")
const express = require("express")
const bodyParser = require("body-parser")
const jwt = require("jsonwebtoken")
const {
	randomString,
	containsAll,
	decodeAuthCredentials,
	timeout,
} = require("./utils");

const config = {
	port: 9001,
	privateKey: fs.readFileSync("assets/private_key.pem"),

	clientId: "my-client",
	clientSecret: "zETqHgl0d7ThysUqPnaFuLOmG1E=",
	redirectUri: "http://localhost:9000/callback",

	authorizationEndpoint: "http://localhost:9001/authorize",
}

const clients = {
	"my-client": {
		name: "Sample Client",
		clientSecret: "zETqHgl0d7ThysUqPnaFuLOmG1E=",
		scopes: ["permission:name", "permission:date_of_birth"],
	},
	"test-client": {
		name: "Test Client",
		clientSecret: "TestSecret",
		scopes: ["permission:name"],
	},
}

const users = {
	user1: "password1",
	john: "appleseed",
}

const requests = {}
const authorizationCodes = {}

let state = ""

const app = express()
app.set("view engine", "ejs")
app.set("views", "assets/authorization-server")
app.use(timeout)
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

/*
Your code here
*/
app.get("/authorize", (req, res) => {
	const clientId = req.query.client_id;
	const scopeStr = req.query.scope
	const scopes = scopeStr ? scopeStr.split(" ") : null; 

	if (!clients.hasOwnProperty(clientId)) {
		return res.status(401).end();
	}

	if (!containsAll(clients[clientId].scopes, scopes)) {
		return res.status(401).end();
	}

	// Store the request
	const requestId = randomString();
	requests[requestId] = req.query;

	// Render login page
	res
		.status(200)
		.render("login", {
			client: clients[clientId],
			scope: scopeStr,
			requestId,
		})
})

app.post("/approve", (req, res) => {
	const {
		userName,
		password,
		requestId
	} = req.body;

	// Checking credentials
	if (!(users.hasOwnProperty(userName) && users[userName] === password)) {
		return res.status(401).end();
	}

	// Checking request existence
	if (!requests.hasOwnProperty(requestId)) {
		return res.status(401).end();
	}
	
	// Save request object
	const clientRequest = requests[requestId];
	const randomCode = randomString();
	
	delete requests[requestId];

	authorizationCodes[randomCode] = {
		clientReq: clientRequest,
		userName
	};

	const params = new URLSearchParams();
	params.set("code", randomCode);
	params.set("state", clientRequest.state);

	res
		.status(200)
		.redirect(`${clientRequest.redirect_uri}?${params.toString()}`)
});

app.post("/token", (req, res) => {
	const authorization = req.headers.authorization;

	if (!authorization) {
		return res.status(401).end();
	};

	const {clientId, clientSecret} = decodeAuthCredentials(authorization);

	// Check client credentials
	if (!(clients.hasOwnProperty(clientId) && clients[clientId].clientSecret === clientSecret)) {
		return res.status(401).end();
	};

	// Check authorization code
	const authCode = req.body.code;

	if (!authorizationCodes.hasOwnProperty(authCode)) {
		return res.status(401).end();
	}

	const authObject = authorizationCodes[authCode];

	delete authorizationCodes[authCode];

	// Issue access token
	const userName = authObject.userName;
	const scope = authObject.clientReq.scope;

	const token = jwt.sign({
		userName,
		scope
	}, fs.readFileSync("./assets/private_key.pem", "utf8"), {
		algorithm: "RS256"
	});

	res.status(200).json({
		access_token: token,
		token_type: "Bearer",
	});
})

const server = app.listen(config.port, "localhost", function () {
	var host = server.address().address
	var port = server.address().port
})

// for testing purposes

module.exports = { app, requests, authorizationCodes, server }
