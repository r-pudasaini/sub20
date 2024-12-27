import { useContext, useEffect, useState } from "react";
import '../assets/css/global.css'
import '../assets/css/Chat.css'
import { toast } from "react-toastify";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Chatroom } from "../contexts/ChatroomContext";
import { Login } from "../contexts/LoginContext";
import {jwtDecode} from 'jwt-decode'
import Countdown from 'react-countdown';


const initialM = [
  {
    text:"m1",
    time:1,
    user:"server"
  },
  {
    text:"m2",
    time:2,
    user:"other"
  },
  {
    text:"m3",
    time:3,
    user:"other"
  },
  {
    text:"m4",
    time:4,
    user:"server"
  },
  {
    text:"m1",
    time:1,
    user:"server"
  },
  {
    text:"m2",
    time:2,
    user:"other"
  },
  {
    text:"m3",
    time:3,
    user:"other"
  },
  {
    text:"m4",
    time:4,
    user:"server"
  },
  {
    text:"m1",
    time:1,
    user:"x2fdB3UyA9er6W7w6mgSF1yrS7L2"
  },
  {
    text:"m2",
    time:2,
    user:"other"
  },
  {
    text:"m3",
    time:3,
    user:"other"
  },
  {
    text:"m4",
    time:4,
    user:"server"
  },
  {
    text:"m1",
    time:1,
    user:"server"
  },
  {
    text:"m2",
    time:2,
    user:"other"
  },
  {
    text:"m3",
    time:3,
    user:"other"
  },
  {
    text:"m4",
    time:4,
    user:"server"
  },
  {
    text:"m1",
    time:1,
    user:"server"
  },
  {
    text:"m2",
    time:2,
    user:"other"
  },
  {
    text:"m3",
    time:3,
    user:"other"
  },
  {
    text:"m4",
    time:4,
    user:"server"
  },
  {
    text:"m1",
    time:1,
    user:"server"
  },
  {
    text:"m2",
    time:2,
    user:"other"
  },
  {
    text:"m3",
    time:3,
    user:"other"
  }
]

function Chat() {

  const {chatDetails, setChatDetails} = useContext(Chatroom)

  const [message, setMessage] = useState("")
  const [allMessages, setAllMessages] = useState(initialM)

  const {loginCookie} = useContext(Login)

  // get the time field of allMessages, divide by 10, add 1. This is the round number. 
  // if this number ever dips beneath zero, the game is over. 

  const [userInfo, setUserInfo] = useState({})

  const navigate = useNavigate()

  const getMessageType = (uid) => {

    if (uid === userInfo.sub)
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

    if (!loginCookie)
    {
      navigate('error/401')
      return
    }

    try {
      const result = jwtDecode(loginCookie)
      setUserInfo(result)

    } catch (error)
    {
      navigate('error/401')
      return
    }

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
        toast.error(error.response.data)
        console.log(error)

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
      <div className="chat-body flex-col">

        <div className="chat-header">

          <div className="chat-partner-info">
            <div>Chatting with: {chatDetails.partnerName}</div>
          </div>

          <div className="chat-countdown">
            <div>Time Left:</div>
            <Countdown date={chatDetails.expiresAt} />
          </div>

        </div>

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
