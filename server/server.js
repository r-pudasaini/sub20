
const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth')
const { getFirestore } = require('firebase-admin/firestore')
const serviceAccount = require('./private_key.json');
const cors = require('cors')

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

app.use(cors())

// !!!TEMPORARY!!!
// !!!REMOVE THIS FROM PRODUCTION BUILD!!!
app.get('/api/DEBUG-chatroom-messages', (req, res) => {

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  db.collection("chat-room/mock-chat-room/messages").onSnapshot((snapshot) => {

    let send_to = []

    snapshot.forEach((data) => {
      send_to.push({
        "text":data.get("text"),
        "time":data.get("time"),
        "user":data.get("user")
      })
    })

    const toSend = `${JSON.stringify(send_to)}\n\n`
    res.write(`data: ${toSend}`)
  })

})

app.get('/api/get-chatroom-messages', (req, res) => {

  if (typeof(req.cookies.auth_token) === "undefined")
  {
    res.statusCode = 401
    res.end("Authentication Failed: No auth_token provided")
    return
  }

  // TODO: using the auth-token the client provides, we will look up the email of the user
  // in the DB, and find which chatroom they belong to. This endpoint will first send all the messages in the 
  // chatroom to the user, and steadily send new messages to the user, as they appear from their partner, as snapshots. 

  auth.verifyIdToken(req.cookies.auth_token).then((decoded) => {

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    db.collection("chat-room/mock-chat-room/messages").onSnapshot((snapshot) => {

      let send_to = []

      snapshot.forEach((data) => {
        send_to.push({
          "text":data.get("text"),
          "time":data.get("time"),
          "user":data.get("user")
        })
      })

      res.write(`data: ${JSON.stringify(send_to)}\n\n`)
    })

  }).catch((error) => {
    res.statusCode = 401
    res.end(`Authentication failed: ${error}`)
  })
})

/*
  Adds a messages send from the user (who we verify by examining their auth-token header)
*/
app.post('/api/send-chatroom-message', jsonParser, (req, res) => {


  const isValidMessage = (str, existingMessages) => {

    // one word, non-empty, a non-duplicate, ascii chars only.

    if (typeof(str) === "undefined" || str === "")
    {
      return "Error: Message must not be empty";
    }

    if (!(/^[a-zA-Z]+$/.test(str)))
    {
      return "Error: Invalid Character Detected in Message";
    }


    // TODO: check if str is the same as a message already sent. 
    if (existingMessages.includes(str.toLocaleLowerCase()))
    {
      return `Error: ${str} already exists`
    }

  }

  if (typeof(req.cookies.auth_token) === "undefined")
  {
    res.statusCode = 401
    res.send("Authentication failed: missing auth token cookie")
    return
  }

  auth.verifyIdToken(req.cookies.auth_token).then(async (decoded) => {

    const message2send = req.body.message

    const messagesRef = db.collection("chat-room/mock-chat-room/messages")
      // in a more completed implementation, dev-chat-room would instead be the chat room that the current player is assigned to
      // if the current player is assigned to no chat room at all, then we send them a 403 error

    const data = await messagesRef.get()

    const existingMessages = []

    data.docs.forEach((val) => {
      existingMessages.push(val.get("text").toLocaleLowerCase())
    })

    const errorMessage = isValidMessage(message2send, existingMessages)

    if (errorMessage)
    {
      res.statusCode = 400
      res.send(errorMessage)
      return
    }


    await messagesRef.add({
      text: message2send,
      user: decoded.email,
      time: Date.now()
    })

    res.statusCode = 200
    res.send("")

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
