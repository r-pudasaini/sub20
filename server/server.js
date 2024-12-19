
const express = require('express')
const cookieParser = require('cookie-parser')

const { initializeApp } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth')

const app = express()
const port = 10201

//import { initializeApp } from "firebase-admin/app";
//import { getAuth } from "firebase-admin/auth";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

const fApp = initializeApp(firebaseConfig);
const auth = getAuth(fApp);

app.use(cookieParser())
app.use(express.static('../webapp'))

app.get('/api/verify-login', (req, res) => {

  if (typeof(req.cookies.auth_token) === "undefined")
  {
    res.statusCode = 401
    res.send("Authentication failed: missing auth token cookie")
    return
  }

  auth.verifyIdToken(req.cookies.auth_token).then((decoded) => {
    res.statusCode = 200
    res.send("Valid token given")

  }).catch((error) => {
    res.statusCode = 401
    res.send(`Authentication failed: ${error}`)
  })
  
})

// redirect 404 errors to the client
app.use((req, res, next) => { 
  res.status(404).sendFile('index.html', {root: '../webapp/'})
}) 

app.listen(port, () => {
  console.log(`listening on port ${port}`)
})
