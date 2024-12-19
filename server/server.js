
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

app.get('/api/get-chatroom', (req, res) => {

  // TODO: here the user should supply the chat information they were given from earlier. 
  // this will allow us to search the chatroom by its ID, and verify the person requesting the chat-room's messages 
  // are indeed authorized to view that chat. 

  // if they do not provide the chat information as a cookie, or the information is invalid, then 
  // we will just look up the email of the user in the DB, and if the email is part of a valid chat-room, then 
  // we will return information about their chat-room, just as we would in '/api/verify-login/'

  // if the client is not part of a chatroom, we will return 403 

  // if the client's auth token is missing or invalid, we will return 401. 

  res.statusCode = 403 
  res.send("Chat rooms not implemented yet.")
})


app.get('/api/verify-login', (req, res) => {

  if (typeof(req.cookies.auth_token) === "undefined")
  {
    res.statusCode = 401
    res.send("Authentication failed: missing auth token cookie")
    return
  }

  auth.verifyIdToken(req.cookies.auth_token).then((decoded) => {
    res.statusCode = 200
    
    /*
      TODO: this is where things get a bit complicated. 
      we now have the information of the user that requested entry into our game. 

      so what will we do? we need to check our database to see if a user with the email provided in the token already 
      exists in a chatroom. If they do, then we will respond with the room number of that chatroom, and all the messages that have been sent 
      in the chatroom thus far. 

      If the user is NOT part of a game room, then they need to be added into a queue until another non-DB user attempts to log in.
      If the queue already has a user that's waiting, then we need to create a DB Chatroom entry that will have a foreign key pointing 
      to two users, along with its own primary key, 

      and two user entries who will have their own primary keys and a foreign key pointing to the chat they belong to. 

      on a successful call, this function will return information about the chat-room the client connected to, like the room's id number, 
      the time left until the room expires, and the name of the other person in the connection
    */

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
