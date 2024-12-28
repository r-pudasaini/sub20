
const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const serviceAccount = require('./private_key.json');
const cors = require('cors')
const Mutex = require('async-mutex').Mutex;
const {EventEmitter, once } = require('node:events');
const { assert } = require('node:console');

const app = express()
const port = 10201

const MILLI_SECONDS_PER_MINUTE = 60_000
const DEFAULT_CHAT_TIME = 10 * MILLI_SECONDS_PER_MINUTE
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

const emitterLock = new Mutex()
const findPartnerEmitter = new EventEmitter()

app.use(cookieParser())
app.use(express.static('../webapp'))

app.use(cors())

function getRandomCategory()
{
  // TODO: populate this with more random categories 
  // some ideas: 'Common First Names', 'Favorite Companies', 'Colors', 'Fruits', 'Vegetables', 'Reptiles', 'Mammals', 
  // 'Marine Animals', 'Countries in the World', 'States of the USA', 'popular songs', 
  return 'Animals'
}

async function isRegisteredPlayer(player)
{
  const players = db.collection("players/").where("uid", '==', player)
  const player_data = await players.get()

  return player_data.docs.length !== 0
}

async function getPlayerChatroomName(player)
{
  const players = db.collection("players/").where("uid", '==', player)
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

// MUST BE CALLED ON REGISTERED PLAYERS ONLY
// SERVER WILL CRASH OTHERWISE
async function getChatInfoOfPlayer(playerUID)
{
  const roomName = await getPlayerChatroomName(playerUID)
  const roomData = await db.doc(`chat-room/${roomName}`).get()

  const partnerUID = roomData.get("players").find((uid) => {
    return uid !== playerUID
  })

  assert(partnerUID, "Error expected partnerName to be a defined value")

  const partnerDocs = await db.collection('players').where("uid", "==", partnerUID).get()

  assert(partnerDocs.docs.length === 1, "Expected exactly one partner to be available")

  const partnerName = partnerDocs.docs[0].get("name")
  const partnerEmail = partnerDocs.docs[0].get("email")

  return {
    partnerName,
    partnerEmail,
    category:roomData.get('category'),
    expiresAt:roomData.get('expiry_time')
  }
}

function registerRoomUpdateCallback(roomId)
{
  const roomFieldsRef = db.doc(`chat-room/${roomId}`)
  const messagesRef = db.collection(`chat-room/${roomId}/messages`)

  const gameOverEmitter = new EventEmitter()

  const unsub = roomFieldsRef.onSnapshot(async (snapshot) => {

    const updatedTransitArray = snapshot.get("transit_messages")
    const roundVal = snapshot.get("round")

    if (updatedTransitArray.length === 2)
    {

      let room_death_message = ""

      if (updatedTransitArray[0].text.toLocaleLowerCase() === updatedTransitArray[1].text.toLocaleLowerCase())
      {
        room_death_message = "Victory!"
      }
      else if (roundVal > 20)
      {
        room_death_message = "Defeat: Out of rounds"
      }
      else if (Date.now() > roomFieldsRef.get("expiry_time"))
      {
        room_death_message = "Defeat: Time ran out"
      }

      await messagesRef.add(updatedTransitArray[0])
      updatedTransitArray[1].time++
      await messagesRef.add(updatedTransitArray[1])


      if (room_death_message)
      {
        await messagesRef.add({
          text: room_death_message,
          user: "server-first",
          time: roundVal * 10 + 2
        })
      }
      else
      {
        await messagesRef.add({
          text: `Round ${roundVal + 1}`,
          user: "server",
          time: roundVal * 10 + 2
        })
      }

      await db.doc(`chat-room/${roomId}`).update({
        transit_messages: [],
        round : FieldValue.increment(1),
        room_death_message
      })

      if (room_death_message)
      {
        gameOverEmitter.emit("game-over")
      }
    }
  })

  gameOverEmitter.once('game-over', () => {
    console.log("unsubbing from update room listener")
    unsub()
  })

}

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
      room_name = await getPlayerChatroomName(decoded.uid)
    }
    catch (error) {
      res.status = error.code
      res.send(error.message)
      return
    }


    const roomFieldsRef = await db.doc(`chat-room/${room_name}`).get()
    const deathMessage = roomFieldsRef.get("room_death_message")
    
    if (deathMessage)
    {
      res.statusCode = 400
      res.send(`The game in this room is over. Please join another room.`)
      return
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const unsub = db.collection(`chat-room/${room_name}/messages`).onSnapshot((snapshot) => {

      let send_to = []

      snapshot.forEach((data) => {
        send_to.push({
          "text":data.get("text"),
          "time":data.get("time"),
          "user":data.get("user")
        })
      })

      res.write(`data: ${JSON.stringify(send_to)}\n\n`)

      // TODO: somehow, within the snapshot, we need to figure out if the game on this 
      // chatroom is over. 

    })

    req.on("close", () => {
      console.log("unsubbing from get-chatroom snapshot")
      unsub()
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

    let room_name

    try {
      room_name = await getPlayerChatroomName(decoded.uid)
    }
    catch (error) {
      res.status = error.code
      res.send(error.message)
      return
    }

    const message2send = req.body.message

    const messagesRef = db.collection(`chat-room/${room_name}/messages`)
    const roomFieldsRef = db.doc(`chat-room/${room_name}`)
    const chatRef = await roomFieldsRef.get()
    const roundVal = chatRef.get("round")
    const data = await messagesRef.get()

    const deathMessage = chatRef.get("room_death_message")

    if (deathMessage)
    {
      res.statusCode = 400
      res.send(`The game in this room is over. Please join a new room.`)
      return
    }

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

    const earlierMessage = chatRef.get("transit_messages").find((value) => {
      return value.user === decoded.uid
    })

    if (earlierMessage)
    {
      res.statusCode = 400
      res.send(`You already sent a message for round ${roundVal}`)
      return
    }

    await roomFieldsRef.update({
      transit_messages: FieldValue.arrayUnion({text:message2send, time:roundVal * 10, user:decoded.uid})
    })

    res.statusCode = 200
    res.send("")

  }).catch((error) => {
    res.statusCode = 401
    res.send(`Authentication failed: ${error}`)
  })

})

app.get('/api/chat-info', (req, res) => {
  if (typeof(req.cookies.auth_token) === "undefined")
  {
    res.statusCode = 401
    res.send("Authentication failed: missing auth token cookie")
    return
  }

  auth.verifyIdToken(req.cookies.auth_token).then(async (decoded) => {
    const registered = await isRegisteredPlayer(decoded.uid)

    if (!registered)
    {
      res.statusCode = 403
      res.send("Must be registered within a chatroom")
      return
    }

    const chatInfo = await getChatInfoOfPlayer(decoded.uid)
    res.statusCode = 200
    res.send(chatInfo)


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

    const registered = await isRegisteredPlayer(decoded.uid)

    // TODO: add a function that will attempt to un-register a player. 
    // the function will return true if the player was part of a dead room, and was removed from it
    // Returns false if the player was part of an active chatroom, or no chatroom at all. 

    if (!registered)
    {
      const release = await emitterLock.acquire()

      if (findPartnerEmitter.listenerCount("find-partner") === 0)
      {
        let partnerFound = once(findPartnerEmitter, "find-partner")
        release()
        const result = await partnerFound 

        assert(result.length === 1, "Error: Expected exactly one chatroom id argument of type string")
        assert(typeof(result[0]) === 'string', "Error: Expected exactly one chatroom id argument of type string")

        await db.doc(`chat-room/${result[0]}`).update({
          players: FieldValue.arrayUnion(decoded.uid)
        })

        await db.collection('players/').add({
          email:decoded.email || "anonymous",
          uid:decoded.uid,
          name:decoded.name || "[Anonymous]",
          room:result[0]
        })

      }
      else if (findPartnerEmitter.listenerCount("find-partner") == 1)
      {
        const category = getRandomCategory()

        const rv = await db.collection("chat-room").add({
          round: 1, 
          transit_messages: [],
          players: [decoded.uid],
          expiry_time: Date.now() + DEFAULT_CHAT_TIME,
          category,
          room_death_message: ""
        })

        await db.collection('players/').add({
          email:decoded.email || "anonymous",
          uid:decoded.uid,
          name:decoded.name || "[Anonymous]",
          room:rv.id
        })

        await db.collection(`chat-room/${rv.id}/messages`).add({
          text: `Welcome to Sub 20! Your category is ${category}, you have 10 minutes and 20 chances to send the same message as your partner. Good Luck!`,
          user: "server-first",
          time: 1
        })

        await db.collection(`chat-room/${rv.id}/messages`).add({
          text: 'Round 1',
          user: "server",
          time: 2
        })

        registerRoomUpdateCallback(rv.id)
        findPartnerEmitter.emit("find-partner", rv.id)
        assert(findPartnerEmitter.listenerCount("find-partner") === 0, "Error: Expected there to be no more listeners after emit.")
        release()
      }
      else
      {
        // throw an internal server error
        release()
        res.statusCode = 500
        res.send("Error: Too many listeners on find partner callback")
        return
      }
    }

    const chatInfo = await getChatInfoOfPlayer(decoded.uid)
    res.statusCode = 200
    res.send(chatInfo)


  }).catch((error) => {
    res.statusCode = 401
    res.send(`Authentication failed: ${error}`)
  })
  
})

// redirect 404 errors to the client for them to route
app.use((req, res, next) => { 
  res.status(404).sendFile('index.html', {root: '../webapp/'})
}) 

app.listen(port, () => {
  console.log(`listening on port ${port}`)
})
