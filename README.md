# Sub 20 - A Two-player Chatroom Game

This repository contains the source code for an implementation of Sub20's API, and a client React application that interacts with it.  

For those interested in playing the game, and learning its rules, click [here](https://sub20-362137876022.us-east4.run.app/) to review an instance of the server running a React App on Google Cloud. 


## Client Directory

The client folder contains a React Application that requires the user to authenticate themselves using Firebase's Authentication API, before they can play the game. 


## Server Directory

The server directory contains the source code for the Express/Node JS server that implements Sub 20's API, and a package.json file that lists dependencies and scripts this implementation uses. 

## Rules

The rules of the game are as follow: 

 - You MUST present a valid Firebase-issued JWT to Sub 20 as a cookie called *auth_token* to access the API
 - When you make a request to start a game, you cannot undo that request 
 - When you enter a game room, you will be assigned to a partner, and a category. All messages you send to your partner should belong to that category. 
 - You may only send one message during each round, and at most two words per message 
 - You cannot send a message that has been sent already in earlier rounds
 - You have up to 20 seconds during each round to send a message, and up to 20 rounds to send the same message as your partner (hence the name, Sub20)
 - The message you and your partner sent for the current round will NOT be revealed until the server receives both of your messages. 
 - You can only be part of a single chatroom at a time. You are not allowed to leave a room until that room expires. That is:
    - You or your partner run out of time to send a message 
    - You run out of rounds 
    - You sent the same message


## Sub 20 API

The following is an account of the API functions that Sub 20 exposes for any client. Other developers who wish to implement an instance of Sub 20 must follow the specifications of this API. 

Note that all these endpoints verify the user contains a valid, Firebase-issued JWT login token provided as a cookie called *auth_token* 

Failure to present a valid ID token to any API endpoint will return a 
401 UNAUTHORIZED Error to the client. 


### GET  /api/start-game
> Registers a New Player into a chatroom. Players are considered to be ‘New’ if they have never played a game with the server before, or if they recently left their chatroom. If a player calls into this endpoint, and there are no other players waiting to join a game, this player will be transferred to the ‘WAITING’ state. Future connections by other players to this endpoint will attempt to pair the WAITING player with the NEW player, thus starting a new game. 
>  
> If an instance of a chat-game is created for the two players, they will be moved to the IN_ROOM state. In this case, start-game will return a 200 OK response to the client, along with information about the chat-room the player is in. This includes: 
> - their partner’s name
> - partner’s email
> - the room category
> - the time the room expires (measured in milliseconds since the Unix Epoch)
> - the player’s current state, which is one of
>     - YOUR_TURN : if the player has yet to send a message for this round
>     - PENDING : if we are waiting for the player's partner to send a message for this round 
>     - DEAD : if the game is over
> - An array of all the messages in the room thus far
>
> Users that are already part of a chat-room who connect to this endpoint will receive a 200 OK, along with the aforementioned chat-information without registering to enter a new chatroom. 
> 
> Clients should update this chat-information object, or a similar copy of it, as the game continues. 
> 
> When the client is already in a chat-room, a call to **/api/start-game** is equivalent to requesting **/api/chat-info** 

### GET /api/chat-info
> On success, returns an object containing information about the player’s current chatroom.
> The contents of this object is the same as the body of a successful return from **/api/start-game**
> 
> Returns 403 FORBIDDEN error if the user is not registered to a chatroom already. 

### GET /api/get-chatroom-messages
> Creates an event stream that sends messages to players. Each time the server internally adds new messages to an existing chatroom, this endpoint will send those new messages to all clients that belong to this chatroom, and have connected to this endpoint. When the server detects an event that should be the end of a game, such as two players sending the same message, or a Round Timeout, this endpoint will send a final message indicating the game is over, the reason for the game ending, and terminate the connection. 
> Whether this endpoint sends the **entire** array of messages in the room when there is a change (as the server in this repo does), or only new messages as they appear, is left as an implementation-specific detail. 
> 
> Each chat-message is sent as a string, represented in JSON format, behind a data header. Each message, when parsed into JSON format, will contain three fields
> - text : The contents of the message
> - time : A number relative to zero that indicates when the message was sent. Messages with a time field closer to zero were sent earlier in time than messages with greater time field values. Thus, clients should sort messages according to this time field for users. 
> 
> - user: A UID belonging to the user who sent this message, OR a special value indicating it was sent by the server. The special values include:
>     - "server" : Used to indicate a new round in the room 
>     - "server-first" : Used to indicate an informational message sent from the server 
>     - "server-first-category" : Used to indicate important information from the server. Clients should emphasize messages from this sender in a meaningful way. 
>     
> Every 15 seconds, **/api/get-chatroom-messages** also sends an empty array to convey to clients that the connection should not be terminated from inactivity.
> 
> Clients that request this endpoint when their respective game ended will receive a 200 OK response, an array of all the messages belonging to the chatroom, a game over message described earlier, followed by the termination of this connection.
>

### POST /api/send-chatroom-message 
> Attempts to send a message to the chatroom the player is registered with. If the player is not registered to any chatroom, a 403 Forbidden error will be returned. 
> The body of the **/api/send-chatroom-message** request MUST be a JSON object contianing a key called "message", mapped to the message the client wishes to send.
> 
> If the game in the room is already over, a 400 BAD REQUEST will be returned. If the player sends an invalid message, or no message at all, a 400 BAD REQUEST will be returned. 
>
> If the message is successfully inserted to the Firestore database, a 200 OK response will be returned. The response will not contain any data at all. Client's should transition their internal state to "PENDING" following a successful call to **/api/send-chatroom-message**

### GET /api/unregister-player
> Attempts to remove a registered player from their chatroom. If the player is not registered to a chatroom, or the chatroom they are currently in has not ended yet, then a 403 FORBIDDEN error will be returned, along with an error message indicating the reason. 
>
> Otherwise, a 200 OK response will be returned with no other data, and the user will enter the ‘NEW_PLAYER’ state in the database, allowing them to enter a new chatroom once more. 

