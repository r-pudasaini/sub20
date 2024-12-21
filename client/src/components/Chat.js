import { useEffect, useState } from "react";
import '../assets/css/global.css'
import '../assets/css/Chat.css'
import { toast } from "react-toastify";
import axios from "axios";


function Chat() {

  //const [messages, setMessages] = useState([])

  // TODO: response will have the most recent chat messages, we will display these
  // as the game progresses. 

  // we can do this using server-side events, and an event source. 
  // the server will maintain its own database of chat-rooms, registered users, and messages in each chatroom. 
  // when a user is logged in and authenticated, they will recieve live updates from the server regarding the 
  // state of the chat-room the client is in. These messages will be properly rendered for the user, by us (client code)

  // so we can encapsulate all the document-related logic on the server, and let the client only send messages it wants the server to 
  // have through some api endpoint, and recieve messages from another api endpoint. 

  const [message, setMessage] = useState("")

  const handleSubmit = (e) => {
    e.preventDefault()

    // TODO: here, as well as the server, we need to verify that the message is valid. 
    // that is one word, non-empty, a non-duplicate, etc. 

    if (message === "")
    {
      toast.error("Invalid Message Given")
      return
    }

    console.log(message)

    axios.post('/api/send-chatroom-message', {message}).then((response) => {


      toast.success("Message Sent!")
      setMessage("")

    }).catch((error) => {
      //TODO: depending on the type of error, we will perform an action. 
      // if it was a verification error, we will clear the auth-token cookie, and ask the 
      // user to sign in again. 

      // if it was an internal server error, we will just display a toast message. 

      console.log(error)
    })

  }


  return (
    <div className="center-contents-horizontal center-contents-vertical flex-col margin-top chat-container">

      <form 
        className="chat-form flex-col"
        onSubmit={handleSubmit}
      >
        <input
          className="chat-input"
          placeholder="type your message here"
          onChange={(e) => setMessage(e.target.value)}
          value={message}
        />
        <button className="chat-button button" type="submit">
          Send Message
        </button>
      </form>

    </div>
  )

}

export default Chat;