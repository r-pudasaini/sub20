
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

const {categories} = require('./categories')

const app = express()
const port = 10201

const MILLI_SECONDS_PER_MINUTE = 60_000
//const DEFAULT_CHAT_TIME = 10 * MILLI_SECONDS_PER_MINUTE
const DEFAULT_CHAT_TIME = 10 * 1000
const HEARTBEAT_DELAY = 3 * 10000
const MAX_ROUNDS = 2
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
const gameOverEmitter = new EventEmitter()

app.use(cookieParser())
app.use(express.static('../webapp'))

app.use(cors())

function getRandomCategory()
{
  return categories[Math.floor(Math.random() * categories.length)]
}

async function isRegisteredPlayer(player)
{
  const players = db.collection("players/").where("uid", '==', player)
  const player_data = await players.get()

  return player_data.docs.length !== 0
}

async function unregister(player, isRegistered)
{
  // TODO: 
  // 1. check the player's chatroom in the DB
  // 2. in that chatroom record, remove the player from the players entry array
  // 3. in the register room update callback, add a snapshot that will 
  // delete the chatroom when both players remove themselves from the players entry array
  // when this operation is done, the snapshot must unsub itself. 

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

function registerRoomCallbacks(roomId, expiryTime)
{
  const roomFieldsRef = db.doc(`chat-room/${roomId}`)
  const messagesRef = db.collection(`chat-room/${roomId}/messages`)

  const timeoutId = setTimeout(async () => {
    await roomFieldsRef.set({
      room_death_message: "Defeat: Ran out of time"
    })
    gameOverEmitter.emit(`${roomId}/game-over`)
  }, expiryTime - Date.now())

  const unsubUpdateMessage = roomFieldsRef.onSnapshot(async (snapshot) => {

    const updatedTransitArray = snapshot.get("transit_messages")
    const roundVal = snapshot.get("round")
    const expiresAt = snapshot.get("expiry_time")

    if (updatedTransitArray.length === 2)
    {

      let room_death_message = ""

      if (updatedTransitArray[0].text.toLocaleLowerCase() === updatedTransitArray[1].text.toLocaleLowerCase())
      {
        room_death_message = "Victory!"
        clearTimeout(timeoutId)
      }
      else if (roundVal >= MAX_ROUNDS)
      {
        room_death_message = "Defeat: Out of rounds"
        clearTimeout(timeoutId)
      }
      else if (Date.now() > expiresAt)
      {
        // no need to do anything, as the timeout function should have fired, and 
        // therefore prevent any more messages from being sent to the database, or other 
        // clients from reading any more messages. 
        // this code-block is mostly just a sanity check. 
        return
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
        gameOverEmitter.emit(`${roomId}/game-over`)
      }
    }
  })

  // TODO: uncomment this when we have delete player functionality. 
  //const unsubDeleteRoom = roomFieldsRef.onSnapshot(async (snapshot) => {
  //  const playerArray = snapshot.get("players")
  //  if (playerArray.length === 0)
  //  {
  //    gameOverEmitter.emit(`${roomId}/delete-db`)
  //  }
  //})

  gameOverEmitter.once(`${roomId}/game-over`, () => {
    console.log("unsubbing from update room listener")
    unsubUpdateMessage()
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
    })

    const heartbeatId = setInterval(() => {
      res.write("data: []\n\n")

    }, HEARTBEAT_DELAY)

    gameOverEmitter.once(`${room_name}/game-over`, () => {
      clearInterval(heartbeatId)
      res.end("data: game over\n\n")
    })

    req.on("close", () => {
      console.log("connection closed. unsubbing from get-chatroom snapshot")
      unsub()
    })

    req.on("end", () => {
      console.log("client disconnected. unsubbing from get-chatroom snapshot")
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

    // TODO: call and invoke a function that will attempt to un-register a player. 
    // the function will return true if the player was part of a dead room, and was removed from it
    // Returns false if the player was part of an active chatroom, or no chatroom at all. 

    const chatInfo = {
      partnerName:"",
      partnerEmail:"",
      category:"",
      expiresAt:-1
    }

    if (!registered)
    {
      const release = await emitterLock.acquire()

      if (findPartnerEmitter.listenerCount("find-partner") === 0)
      {

        let partnerFound = once(findPartnerEmitter, "find-partner")
        release()
        const partnerArgs = await partnerFound 

        assert(partnerArgs.length === 5, "Error: Expected five chatroom arguments")
        assert(typeof(partnerArgs[0]) === 'string', "Error: Expected arg 0 to be a string")
        assert(typeof(partnerArgs[1]) === 'string', "Error: Expected arg 1 to be a string")
        assert(typeof(partnerArgs[2]) === 'string', "Error: Expected arg 2 to be a string")
        assert(typeof(partnerArgs[3]) === 'string', "Error: Expected arg 3 to be a string")
        assert(typeof(partnerArgs[4]) === 'number', "Error: Expected arg 4 to be a number")

        await db.doc(`chat-room/${partnerArgs[0]}`).update({
          players: FieldValue.arrayUnion(decoded.uid)
        })

        await db.collection('players/').add({
          email:decoded.email || "anonymous",
          uid:decoded.uid,
          name:decoded.name || "[Anonymous]",
          room:partnerArgs[0]
        })

        chatInfo.partnerName = partnerArgs[1]
        chatInfo.partnerEmail = partnerArgs[1]
        chatInfo.category = partnerArgs[3]
        chatInfo.expiresAt = partnerArgs[4]

        findPartnerEmitter.emit(`${partnerArgs[0]}/partner-details`, decoded.name || '[Anonymous]', decoded.email || 'anonymous')

      }
      else if (findPartnerEmitter.listenerCount("find-partner") == 1)
      {
        const category = getRandomCategory()
        const expiry_time = Date.now() + DEFAULT_CHAT_TIME

        const rv = await db.collection("chat-room").add({
          round: 1, 
          transit_messages: [],
          players: [decoded.uid],
          expiry_time,
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

        registerRoomCallbacks(rv.id, expiry_time)
        findPartnerEmitter.emit("find-partner", rv.id, decoded.name || '[Anonymous]', decoded.email || 'anonymous', category, expiry_time)
        release()

        const partnerDetails = await once(findPartnerEmitter, `${rv.id}/partner-details`)

        assert(partnerDetails.length === 2, "Error: Expected 2 chatroom arguments")
        assert(typeof(partnerDetails[0]) === 'string', "Error: Expected arg 0 to be a string")
        assert(typeof(partnerDetails[1]) === 'string', "Error: Expected arg 1 to be a string")

        chatInfo.category = category
        chatInfo.expiresAt = expiry_time
        chatInfo.partnerName= partnerDetails[0]
        chatInfo.partnerEmail = partnerDetails[1]
      }
      else
      {
        // throw an internal server error
        release()
        res.statusCode = 500
        res.send("Error: Too many listeners on find partner callback")
        return
      }

      res.statusCode = 200
      res.send(chatInfo)
      return 
    }
    else
    {
      res.statusCode = 200
      //res.send(await getChatInfoOfPlayer(decoded.uid))
      res.send("")
    }

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
