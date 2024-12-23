import { useEffect, useState } from "react";
import '../assets/css/global.css'
import '../assets/css/Chat.css'
import { toast } from "react-toastify";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {auth} from '../firebase-config'

function Chat() {

  // TODO: response will have the most recent chat messages, we will display these
  // as the game progresses. 

  // we can do this using server-side events, and an event source. 
  // the server will maintain its own database of chat-rooms, registered users, and messages in each chatroom. 
  // when a user is logged in and authenticated, they will recieve live updates from the server regarding the 
  // state of the chat-room the client is in. These messages will be properly rendered for the user, by us (client code)

  const [message, setMessage] = useState("")
  const [allMessages, setAllMessages] = useState([])

  const navigate = useNavigate()

  const sortAndSetMessages = (messageArray) => {

    messageArray.sort((m1, m2) => {
      return m2.time - m1.time
    })

    setAllMessages(messageArray)
  }

  useEffect(() => {

    const evtSource = new EventSource("http://localhost:10201/api/DEBUG-chatroom-messages");

    evtSource.addEventListener("message", (alert) => {
      sortAndSetMessages(JSON.parse(alert.data))
    })

    return () => {
      evtSource.close()
    }

  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()

    // TODO: here, as well as the server, we need to verify that the message is valid. 
    // that is: one word, non-empty, a non-duplicate, ascii chars only.

    if (message === "")
    {
      toast.error("Invalid Message Given")
      return
    }

    axios.post('/api/send-chatroom-message', {message}).then((response) => {


      toast.success("Message Sent!")
      setMessage("")

    }).catch((error) => {
      //TODO: depending on the type of error, we will perform an action. 
      // if it was a verification error, we will clear the auth-token cookie, and ask the 
      // user to sign in again. 

      // if it was an internal server error, we will just display a toast message. 
      if (error.status >= 400 && error.status <= 499)
      {
        navigate(`/error/${error.status}`)
      }
      else
      {
        toast.error("Failed to connect. Please try again later")
        navigate('/')
      }

    })

  }


  return (
    <div className="center-contents-horizontal center-contents-vertical flex-col chat-container">

      <div className="chat-message-window">

        {
          allMessages.map((mess) => {

            return auth.currentUser.email === mess.user ? (
              <div className="chat-message-element chat-message-me">
                {mess.text}
              </div>

            ) : (
              <div className="chat-message-element chat-message-other">
                {mess.text}
              </div>
            )

          })

        }
      </div>

      <form 
        className="chat-form flex-row"
        onSubmit={handleSubmit}
      >
        <input
          className="chat-input"
          placeholder="type your message here"
          onChange={(e) => setMessage(e.target.value)}
          value={message}
        />
        <button className="chat-button button" type="submit">
          <i className="fa-solid fa-share"></i>
        </button>
      </form>

    </div>
  )

}

export default Chat;