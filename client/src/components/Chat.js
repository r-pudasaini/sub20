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
import HowToPlayPopup from "./HowToPlayPopup";

const ChatStates = {
  YOUR_TURN:"YOUR_TURN",
  PENDING: "PENDING",
  DEAD: "DEAD"
}

const placeholders = {
  "YOUR_TURN":"type something here",
  "PENDING":"waiting for partner",
  "DEAD":"room is dead. Thanks for playing!"
}

function Chat() {

  const {chatDetails, setChatDetails} = useContext(Chatroom)

  const [message, setMessage] = useState("")
  const [copyMessage, setCopyMessage] = useState(chatDetails.transitMessage || "")
  const [allMessages, setAllMessages] = useState(chatDetails.messages || [])
  const [popup, setPopup] = useState(false)

  const {loginCookie} = useContext(Login)

  const [userInfo, setUserInfo] = useState({})
  const [roomState, setRoomState] = useState(chatDetails.state)

  useEffect(() => {

    setChatDetails({...chatDetails, messages: allMessages, state: roomState, copyMessage: transitMessage})

  }, [roomState, allMessages, setChatDetails, copyMessage])

  const navigate = useNavigate()

  const getClassForState = () => {
    return roomState === ChatStates.DEAD ? "chat-dead-room" : "chat-message-window"
  }

  const getMessageType = (uid) => {

    if (uid === userInfo.sub)
    {
      return "chat-message-me"
    }
    else if (uid === "server")
    {
      return "chat-message-server"
    }
    else if (uid === "server-first")
    {
      return "chat-message-server-first"
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

    setRoomState(ChatStates.YOUR_TURN)
    setAllMessages(messageArray)
  }

  useEffect(() => {

    if (!loginCookie)
    {
      navigate('/error/401')
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

      if (alert.data === '[]')
      {
        return
      }
      else if (alert.data === 'game over')
      {
        // TODO: navigate to the game over page, passing the messages as a prop, or a context. 
        evtSource.close()
        return
      }
      else if (alert.data === 'dead room')
      {
        evtSource.close()
        setRoomState(ChatStates.DEAD)
        return
      }

      sortAndSetMessages(JSON.parse(alert.data))
    })

    return () => {
      evtSource.close()
    }

  }, [loginCookie, navigate])

  const handleSubmit = (e) => {

    e.preventDefault()

    if (roomState !== ChatStates.YOUR_TURN)
    {
      return
    }

    const dup = String(message)

    const errorMessage = isValidMessage(dup)
    setCopyMessage(dup)

    if (errorMessage)
    {
      toast.error(errorMessage)
      return;
    }

    axios.post('/api/send-chatroom-message', {"message":dup}).then((_) => {

      setMessage("")
      setRoomState(ChatStates.PENDING)

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

  const buttonClass = () => {
    return roomState === ChatStates.YOUR_TURN ? "chat-button" : ""
  }

  return (
    <div className="chat-top-container flex-row">

      {
        roomState === ChatStates.YOUR_TURN &&
        <div className="jersey-15 chat-side-text-positive">
          Your Turn!
        </div>
      }

      {
        roomState === ChatStates.PENDING &&
        <div className="jersey-15 chat-side-text-neutral">
          Waiting for Partner
        </div>
      }

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

          <div className={getClassForState()}>
            {
              roomState !== ChatStates.DEAD &&
              allMessages.map((mess, index) => {
                return (
                  <div className={"chat-message-element " + getMessageType(mess.user)} key={index}>
                    {mess.text}
                  </div>
                )
              })
            }

            {
              roomState === ChatStates.DEAD &&
              <div className="flex-col center-contents-vertical">

                <div className="chat-dead-message jersey-15">
                  The game in this room is over. 
                </div>

                <div className="chat-play-again jersey-15 button"
                  onClick={() => navigate('/start-game')}
                >
                  Play again 
                </div>

              </div>
            }
          </div>
        </div>

        <form 
          className="chat-form flex-row"
        >
          <input
            className="chat-input"
            placeholder={placeholders[roomState]}
            onChange={(e) => setMessage(e.target.value)}
            disabled={roomState !== ChatStates.YOUR_TURN}
            value={message}
          />
          <button
            onClick={handleSubmit}
            className={buttonClass()}
            disabled={roomState !== ChatStates.YOUR_TURN}
          >
            <i className="fa-solid fa-share"/>
          </button>
        </form>

        <div 
          className="chat-rules-popup"
          onClick={() => setPopup(true)}
        >
          Rules
        </div>

        <HowToPlayPopup isActive={popup} setState={setPopup} />

      </div>

      {
        roomState === ChatStates.YOUR_TURN && 
        <div className="jersey-15 chat-side-text-positive">
          Send a Message!
        </div>
      }

      {
        roomState === ChatStates.PENDING && 
        <div className="flex-col center-contents-horizontal center-text">
          <div className="jersey-15 chat-side-text-neutral">
            Your message: 
          </div>
          <div className="jersey-15 chat-side-text-guess">
            {copyMessage}
          </div>
        </div>
      }

    </div>
  )

}

export default Chat;
