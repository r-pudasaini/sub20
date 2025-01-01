const express = require('express')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')

const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const serviceAccount = require('./private_key.json');
const Mutex = require('async-mutex').Mutex;
const {EventEmitter, once } = require('node:events');
const { assert } = require('node:console');
const cors = require('cors')

const {categories} = require('./categories')

const app = express()
const port = 8080 

const MILLI_SECONDS_PER_MINUTE = 60_000
const DEFAULT_CHAT_TIME = 10 * MILLI_SECONDS_PER_MINUTE
const HEARTBEAT_DELAY = MILLI_SECONDS_PER_MINUTE / 4
const MAX_ROUNDS = 20
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
//findPartnerEmitter.setMaxListeners(1)
gameOverEmitter.setMaxListeners(0)

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

  if (player_data.docs.length === 0)
  {
    return false
  }
  else if (player_data.docs.length === 1)
  {
    return player_data.docs[0].get('game_state') === 'IN_ROOM'
  }
  else
  {
    throw {code: 500, msg: "Player was found in multiple documents in the server."}
  }
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

  const roomName = player_data.docs[0].get("room")

  if (!roomName) 
  {
    throw {code:403, msg:"Player is not part of a chatroom"}
  }

  return roomName
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

  const deathMessage = roomData.get("room_death_message")
  let state
  let transitMessage

  if (deathMessage)
  {
    state = "DEAD"
  }
  else
  {

    const transitArr = roomData.get("transit_messages")

    if (transitArr.length === 0 || transitArr[0].user !== playerUID)
    {
      state = "YOUR_TURN"
    }
    else
    {
      state = "PENDING"
      transitMessage = transitArr[0].text
    }
  }


  const messagesRef = await db.collection(`chat-room/${roomName}/messages`).get()

  const messages = []

  messagesRef.docs.forEach((data) => {
    messages.push({
      "text":data.get("text"),
      "time":data.get("time"),
      "user":data.get("user")
    })
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
    expiresAt:roomData.get('expiry_time'),
    state,
    transitMessage,
    messages
  }
}

function registerRoomCallbacks(roomId, expiryTime)
{
  const roomFieldsRef = db.doc(`chat-room/${roomId}`)
  const messagesRef = db.collection(`chat-room/${roomId}/messages`)

  const timeoutId = setTimeout(async () => {

    await roomFieldsRef.update({
      room_death_message: "Defeat: Ran out of time"
    })  // this will trigger the snapshot below: 

  }, expiryTime - Date.now())

  const unsubUpdateMessage = roomFieldsRef.onSnapshot(async (snapshot) => {

    const updatedTransitArray = snapshot.get("transit_messages")
    const roundVal = snapshot.get("round")
    const expiresAt = snapshot.get("expiry_time")

    const deathMessage = snapshot.get("room_death_message")

    if (deathMessage)
    {
      //await messagesRef.add({
      //  text: deathMessage,
      //  user: "server-first",
      //  time: GAME_END_MESSAGE_TIME
      //})
      gameOverEmitter.emit(`${roomId}/game-over`, deathMessage)
      return
    }

    if (updatedTransitArray.length === 2)
    {
      let roomDeathMessage = ""

      if (updatedTransitArray[0].text.toLocaleLowerCase() === updatedTransitArray[1].text.toLocaleLowerCase())
      {
        roomDeathMessage = "Victory!"
        clearTimeout(timeoutId)
      }
      else if (roundVal >= MAX_ROUNDS)
      {
        roomDeathMessage = "Defeat: Out of rounds"
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

      if (!roomDeathMessage)
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
        room_death_message : roomDeathMessage
      })

      if (roomDeathMessage)
      {
        gameOverEmitter.emit(`${roomId}/game-over`, roomDeathMessage)
      }
    }
  })

  const unsubDeleteRoom = roomFieldsRef.onSnapshot(async (snapshot) => {
    const numGone = snapshot.get("num_disconnected")
    if (numGone === 2)
    {
      unsubDeleteRoom()

      const batch = db.batch()
      const messagesRef = await db.collection(`chat-room/${roomId}/messages`).get()
      messagesRef.docs.forEach((message) => {
        batch.delete(message.ref)
      })
      batch.delete(snapshot.ref)
      await batch.commit()
    }
  })

  gameOverEmitter.once(`${roomId}/game-over`, () => {
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

    let roomName

    try {
      roomName = await getPlayerChatroomName(decoded.uid)
    }
    catch (error) {
      res.statusCode = error.code
      res.end(`data: ${error.msg}`)
      return
    }

    const roomFieldsRef = await db.doc(`chat-room/${roomName}`).get()
    const deathMessage = roomFieldsRef.get("room_death_message")

    const messagesQuery = db.collection(`chat-room/${roomName}/messages`)
    
    if (deathMessage)
    {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      })

      const messagesRef = await messagesQuery.get()

      const sendTo = []

      messagesRef.docs.forEach((data) => {
        sendTo.push({
          "text":data.get("text"),
          "time":data.get("time"),
          "user":data.get("user")
        })
      })

      res.write(`data: ${JSON.stringify(sendTo)}\n\n`)
      res.end(`data: game over/${deathMessage}\n\n`)
      return
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const unsub = messagesQuery.onSnapshot((snapshot) => {

      let sendTo= []

      snapshot.forEach((data) => {

        sendTo.push({
          "text":data.get("text"),
          "time":data.get("time"),
          "user":data.get("user")
        })
      })

      res.write(`data: ${JSON.stringify(sendTo)}\n\n`)

    })

    const heartbeatId = setInterval(() => {
      res.write("data: []\n\n")
    }, HEARTBEAT_DELAY)


    const terminateConnection = (updatedDeathMessage) => {
      clearInterval(heartbeatId)
      res.end(`data: game over/${updatedDeathMessage}\n\n`)
    }

    gameOverEmitter.once(`${roomName}/game-over`, terminateConnection)

    req.on("close", () => {
      gameOverEmitter.removeListener(`${roomName}/game-over`, terminateConnection)
      unsub()
    })

    req.on("end", () => {
      gameOverEmitter.removeListener(`${roomName}/game-over`, terminateConnection)
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

    if (typeof(str) !== "string")
    {
      return `Error: Wrong data type passed. Expected string, got ${typeof(str)}`
    }

    if (str === "")
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

    let roomName 

    try {
      roomName = await getPlayerChatroomName(decoded.uid)
    }
    catch (error) {
      res.statusCode = error.code
      res.send(error.message)
      return
    }

    const message2send = req.body.message

    const messagesRef = db.collection(`chat-room/${roomName}/messages`)
    const roomFieldsRef = db.doc(`chat-room/${roomName}`)
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

    let registered

    try {
      registered = await isRegisteredPlayer(decoded.uid)
    }
    catch (error)
    {
      res.statusCode = error.code || 500
      res.send(error.msg || 'Server Error')
    }

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

    const release = await emitterLock.acquire()

    const players = db.collection("players/").where("uid", '==', decoded.uid)
    const playerData = await players.get()

    let playerToRoomStatus
    let playerDocId

    if (playerData.docs.length === 1)
    {
      playerToRoomStatus = playerData.docs[0].get('game_state')
      assert(typeof(playerToRoomStatus) !== "undefined", "Error: expected a value for game state variable.")
      playerDocId = playerData.docs[0].id
    }
    else if (playerData.docs.length === 0)
    {
      const rv = await db.collection("players/").add({
        email:decoded.email || "anonymous",
        uid:decoded.uid,
        name:decoded.name || "[Anonymous]",
        game_state : "NEW_PLAYER"
      })

      playerToRoomStatus = "NEW_PLAYER"
      playerDocId = rv.id
    }
    else {
      console.log("Server Error: Player is part of too many rooms")
      release()
      res.statusCode = 500
      res.send("Server Error: Player is part of many rooms")
      return
    }

    const chatInfo = {
      partnerName:"",
      partnerEmail:"",
      category:"",
      expiresAt:-1,
      state:"YOUR_TURN",
      messages: []
    }

    if (playerToRoomStatus === "NEW_PLAYER")
    {
      if (findPartnerEmitter.listenerCount("find-partner") === 0)
      {

        await db.doc(`players/${playerDocId}`).update({
          game_state : "WAITING"
        })

        const partnerFound = once(findPartnerEmitter, "find-partner")
        release()
        const partnerArgs = await partnerFound 

        await db.doc(`chat-room/${partnerArgs[0]}`).update({
          players: FieldValue.arrayUnion(decoded.uid)
        })

        await db.doc(`players/${playerDocId}`).update({
          room:partnerArgs[0],
          game_state : "IN_ROOM"
        })

        chatInfo.partnerName = partnerArgs[1]
        chatInfo.partnerEmail = partnerArgs[2]
        chatInfo.category = partnerArgs[3]
        chatInfo.expiresAt = partnerArgs[4]

        findPartnerEmitter.emit(`${partnerArgs[0]}/partner-details`, decoded.name || '[Anonymous]', decoded.email || 'anonymous')

      }
      else if (findPartnerEmitter.listenerCount("find-partner") == 1)
      {

        const category = getRandomCategory()
        const expiryTime = Date.now() + DEFAULT_CHAT_TIME

        const rv = await db.collection("chat-room").add({
          round: 1, 
          transit_messages: [],
          players: [decoded.uid],
          expiry_time : expiryTime,
          category,
          room_death_message: "",
          num_disconnected : 0
        })

        await db.doc(`players/${playerDocId}`).update({
          room:rv.id,
          game_state : "IN_ROOM",
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

        registerRoomCallbacks(rv.id, expiryTime)
        findPartnerEmitter.emit("find-partner", rv.id, decoded.name || '[Anonymous]', decoded.email || 'anonymous', category, expiryTime)

        const partnerDetails = await once(findPartnerEmitter, `${rv.id}/partner-details`)
        release() // deferring the release here is necessary since the user may try to refresh the page WHILE we are waiting for 
        // the other player to emit the findPartnerEmitter. 

        chatInfo.category = category
        chatInfo.expiresAt = expiryTime 
        chatInfo.partnerName= partnerDetails[0]
        chatInfo.partnerEmail = partnerDetails[1]
      }
      else
      {
        // throw an internal server error
        console.log(`Got: ${findPartnerEmitter.listenerCount('find-partner')} listeners on the find-partner channel.`)
        release()
        res.statusCode = 500
        res.send("Error: Too many listeners on find partner callback")
        return
      }

      res.statusCode = 200
      res.send(chatInfo)
      return 
    }
    else if (playerToRoomStatus === "WAITING")
    {
      assert(findPartnerEmitter.listenerCount('find-partner') === 1, "Error, expected exactly one listener in find partner.")
      findPartnerEmitter.removeAllListeners('find-partner')
      const partnerFound = once(findPartnerEmitter, "find-partner")
      release()
      const partnerArgs = await partnerFound 

      await db.doc(`chat-room/${partnerArgs[0]}`).update({
        players: FieldValue.arrayUnion(decoded.uid)
      })

      await db.doc(`players/${playerDocId}`).update({
        room:partnerArgs[0],
        game_state : "IN_ROOM"
      })

      chatInfo.partnerName = partnerArgs[1]
      chatInfo.partnerEmail = partnerArgs[2]
      chatInfo.category = partnerArgs[3]
      chatInfo.expiresAt = partnerArgs[4]

      findPartnerEmitter.emit(`${partnerArgs[0]}/partner-details`, decoded.name || '[Anonymous]', decoded.email || 'anonymous')
      res.statusCode = 200
      res.send(chatInfo)
    }
    else if (playerToRoomStatus === "IN_ROOM")
    {
      release()
      res.statusCode = 200
      res.send(await getChatInfoOfPlayer(decoded.uid))
    }
    else
    {
      release()
      res.statusCode = 500
      res.send("Error: Got an invalid game state from the database. Please contact the server owner for assistiance")
    }

  }).catch((error) => {
    res.statusCode = 401
    res.send(`Authentication failed: ${error}`)
  })
  
})


app.get('/api/unregister-player', (req, res) => {

  if (typeof(req.cookies.auth_token) === "undefined")
  {
    res.statusCode = 401
    res.end("Authentication Failed: No auth_token provided")
    return
  }

  auth.verifyIdToken(req.cookies.auth_token).then(async (decoded) => {

    const playerQuery = db.collection("players/").where("uid", '==', decoded.uid)
    const playerData = await playerQuery.get()

    if (playerData.docs.length === 0)
    {
      res.statusCode = 403
      res.send("Player is not part of a chatroom")
      return
    }
    else if (playerData.docs.length > 1)
    {
      res.statusCode = 500
      res.send("Player is part of many chatrooms")
      return
    }

    const roomName = playerData.docs[0].get("room")

    if (!roomName) 
    {
      res.statusCode = 403
      res.send("Player is not part of a chatroom")
      return
    }

    const roomFields = await db.doc(`chat-room/${roomName}/`).get()
    const deathMessage = roomFields.get('room_death_message')

    if (!deathMessage)
    {
      res.statusCode = 403
      res.send("Your room is still alive. You are not allowed to unregister.")
      return
    }

    await db.doc(`chat-room/${roomName}/`).update({
      num_disconnected : FieldValue.increment(1)
    })

    await db.doc(`players/${playerData.docs[0].id}`).update({
      game_state : "NEW_PLAYER"
    })

    res.statusCode = 200
    res.send("")

  }).catch((error) => {
    res.statusCode = 401
    res.end(`Authentication failed: ${error}`)
  })

})

// redirect 404 errors to the client for them to route
app.use((req, res, next) => { 
  res.status(404).sendFile('index.html', {root: '../webapp/'})
}) 

app.listen(port, () => {
  console.log(`listening on port ${port}`)
})
