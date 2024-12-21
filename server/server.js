
const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')
const serviceAccount = require('./private_key.json');
const { credential } = require('firebase-admin');

const app = express()
const port = 10201
const jsonParser = bodyParser.json()

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  credential : cert(serviceAccount)
};

const fApp = initializeApp(firebaseConfig);
const auth = getAuth(fApp);
const db = getFirestore(fApp)

app.use(cookieParser())
app.use(express.static('../webapp'))

app.get('/api/get-chatroom-messages', (req, res) => {

  // again, using the auth-token the client provides, we will look up the email of the user
  // in the DB, and find which chatroom they belong to. This endpoint will first send all the messages in the 
  // chatroom to the user, and steadily send new messages to the user, as they appear from their partner, as snapshots. 

  // if the client is not part of a chatroom, we will return 403 

  // if the client's auth token is missing or invalid, we will return 401. 

  res.statusCode = 403 
  res.send("Chat rooms not implemented yet.")
})

/*
  Adds a messages send from the user (who we verify by examining their auth-token header)
*/
app.post('/api/send-chatroom-message', jsonParser, (req, res) => {

  auth.verifyIdToken(req.cookies.auth_token).then(async (decoded) => {

    const message2send = req.body.message
    const messagesRef = db.collection("chat-room/")

    // TODO: in the path right here, we would replace all that gibberish with the ID of the chatroom the 
    // authenticated user belongs to. If they do not belong to a chatroom, we'd throw a 403. 

    // we would ALSO verify the message the client wants to send (the one they provided) is a valid message. 
    // i.e. it is:
    //    - a string literal
    //    - is one word (no whitespaces or equivalent)
    //    - is not equal to any other message sent already 
    //    - the chatroom is not expired (either in time or number of messages)

    await messagesRef.add({
      text: message2send,
      user: decoded.email,
    })

    res.statusCode = 200
    res.send("Message Recieved")

  }).catch((error) => {
    res.statusCode = 401
    res.send(`Authentication failed: ${error}`)
  })

})


app.get('/api/start-game', (req, res) => {

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
      exists in a chatroom. If they do, then we will respond with the room number of that chatroom, and the time when the chatroom expires. 

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
