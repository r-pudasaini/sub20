import { useEffect, useState } from "react";
import '../assets/css/global.css'
import '../assets/css/Chat.css'
import { toast } from "react-toastify";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {auth} from '../firebase-config'



function Chat() {

  const [message, setMessage] = useState("")
  const [allMessages, setAllMessages] = useState([])

  const navigate = useNavigate()

  const getMessageType = (uid) => {

    if (uid === auth.currentUser.uid)
    {
      return "chat-message-me"
    }
    else if (uid === "server")
    {
      return "chat-message-server"
    }
    return "chat-message-other"
  }

  const isValidMessage = (str) => {

    // one word, non-empty, a non-duplicate, ascii chars only.

    if (typeof(str) === "undefined" || str === "")
    {
      return "Error: Messages must not be empty"
    }

    if (!(/^[a-zA-Z]+$/.test(str)))
    {
      return "Error: Invalid Characters detected in message"
    }

    let lowercaseArr = allMessages.map((msg) => {
      return msg.text.toLocaleLowerCase()
    })

    if (lowercaseArr.includes(str.toLocaleLowerCase()))
    {
      return `Error: ${str} has already been sent` 
    }
  }

  const sortAndSetMessages = (messageArray) => {

    messageArray.sort((m1, m2) => {
      return m2.time - m1.time
    })

    setAllMessages(messageArray)
  }

  useEffect(() => {

    const evtSource = new EventSource("http://localhost:10201/api/get-chatroom-messages");

    evtSource.addEventListener("message", (alert) => {
      sortAndSetMessages(JSON.parse(alert.data))
    })

    return () => {
      evtSource.close()
    }

  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()

    const copyMessage = String(message)

    const errorMessage = isValidMessage(copyMessage)

    if (errorMessage)
    {
      toast.error(errorMessage)
      return;
    }

    axios.post('/api/send-chatroom-message', {"message":copyMessage}).then((response) => {

      setMessage("")

    }).catch((error) => {

      if (error.status === 400) 
      {
        // toast the error message that the server sent. 

      }
      else if (error.status > 400 && error.status <= 499)
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
          allMessages.map((mess, index) => {
            return (
              <div className={"chat-message-element " + getMessageType(mess.user)} key={index}>
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
