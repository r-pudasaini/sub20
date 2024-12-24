
const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
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


async function isValidPlayer(player)
{
  const players = db.collection("players/").where("email", '==', player)
  const player_data = await players.get()

  return player_data.docs.length !== 0
}

async function getPlayerChatroomName(player)
{

  const players = db.collection("players/").where("email", '==', player)
  const player_data = await players.get()

  if (player_data.docs.length === 0)
  {
    throw {code:403, msg:"Player is not part of a chatroom"}
  }
  else if (player_data.docs.length > 1)
  {
    throw {code:500, msg:"Player is part of many chatrooms"}
  }

  const room_name = player_data.docs[0].get("room")

  if (!room_name) 
  {
    throw {code:500, msg:"Player is part of many chatrooms"}
  }

  return room_name
}

// !!!TEMPORARY!!!
// !!!REMOVE THIS FROM PRODUCTION BUILD!!!
app.get('/api/DEBUG-chatroom-messages', (req, res) => {

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });

  db.collection("chat-room/mock-room3/messages").onSnapshot((snapshot) => {

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

  auth.verifyIdToken(req.cookies.auth_token).then(async (decoded) => {

    let room_name

    try {
      room_name = await getPlayerChatroomName(decoded.email)
    }
    catch (error) {
      res.status = error.code
      res.send(error.message)
      return
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    db.collection(`chat-room/${room_name}/messages`).onSnapshot((snapshot) => {

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
  Adds a message sent from the user (who we verify by examining their auth-token cookie)
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

    if (!decoded.email)
    {
      res.status = 403
      res.send("Email field not provided. Necessary to play")
      return
    }

    let room_name

    try {
      room_name = await getPlayerChatroomName(decoded.email)
    }
    catch (error) {
      res.status = error.code
      res.send(error.message)
      return
    }

    const message2send = req.body.message

    const messagesRef = db.collection(`chat-room/${room_name}/messages`)
    const roomFieldsRef = db.doc(`chat-room/${room_name}`)

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

    const chatRef = await roomFieldsRef.get()
    const roundVal = chatRef.get("round")

    const earlierMessage = chatRef.get("transit_messages").find((value) => {
      return value.user === decoded.email
    })

    if (earlierMessage)
    {
      res.statusCode = 400
      res.send(`Player ${decoded.email} has already sent a message for round ${roundVal}`)
      return
    }

    await roomFieldsRef.update({
      transit_messages: FieldValue.arrayUnion({text:message2send, time:roundVal * 10, user:decoded.email})
    })

    const updatedTransit = await roomFieldsRef.get()
    const updatedTransitArray = updatedTransit.get("transit_messages")

    if (updatedTransitArray.length === 2)
    {
      await messagesRef.add(updatedTransitArray[0])
      updatedTransitArray[1].time++
      await messagesRef.add(updatedTransitArray[1])

      await messagesRef.add({
        text: `Round ${roundVal + 1}`,
        user: "server",
        time: roundVal * 10 + 2
      })

      await db.doc(`chat-room/${room_name}`).update({
        transit_messages: [],
        round : FieldValue.increment(1)
      })
    }

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

  auth.verifyIdToken(req.cookies.auth_token).then(async (decoded) => {

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

    const rv = await isValidPlayer(decoded.email)

    if (!isValidPlayer(decoded.email))
    {
      console.log("got an invalid connection")
      res.statusCode = 403
      res.send("Not accepting new emails at this time.")
      return
    }

    res.statusCode = 200
    res.send("")

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
