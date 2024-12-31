import { useContext, useEffect, useState } from "react";
import '../assets/css/global.css'
import '../assets/css/Chat.css'
import { toast, Zoom } from "react-toastify";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Chatroom } from "../contexts/ChatroomContext";
import { Login } from "../contexts/LoginContext";
import {jwtDecode} from 'jwt-decode'
import Countdown from 'react-countdown';
import HowToPlayPopup from "./HowToPlayPopup";
import Confetti from 'react-confetti'

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
  const {loginCookie} = useContext(Login)

  const [message, setMessage] = useState("")  // the message as we type it 
  const [copyMessage, setCopyMessage] = useState(chatDetails.transitMessage || "")  // a copy message which is displayed for the user
  const [allMessages, setAllMessages] = useState( (chatDetails.messages || []).sort( (m1, m2) => m2.time - m1.time))  // an array of all the messages in the room 
  const [popup, setPopup] = useState(false) // the rules popup 


  const [userInfo, setUserInfo] = useState({})  // information of the logged in user according to the login cookie
  const [roomState, setRoomState] = useState(chatDetails.state || "YOUR_TURN") // the state of the room right now (our turn, waiting for partner, or game over)
  const [victory, setVictory] = useState(false) // whether we won or not to display some confetti 

  useEffect(() => {

    setChatDetails({...chatDetails, messages: allMessages, state: roomState, transitMessage: copyMessage})

  }, [roomState, allMessages, setChatDetails, copyMessage])

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

  const startNewGame = () => {

    axios.get('/api/unregister-player').then((_) => {

      setChatDetails({})
      navigate('/start-game')

    }).catch((error) => {

      if (error.status >= 400 && error.status < 500)
      {
        navigate(`/error/${error.status}`)
      }
      else
      {
        toast.error("Failed to connect. Check console for details")
        console.log(error)
        navigate('/')
      }
    })

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
        // heartbeat data to ensure the connection lives over 10 minutes 
        return
      }
      else if (alert.data.startsWith('game over/'))
      {
        const deathMessage = alert.data.substring('game over/'.length)

        toast(<div className="chat-toast-contents jersey-15">{deathMessage}</div>, {
          className : "chat-game-end",
          autoClose : false,
          theme : "light",
          closeButton : false,
          transition : Zoom,
        })

        if (deathMessage === 'Victory!')
        {
          setVictory(true)
        }

        setRoomState(ChatStates.DEAD)
        evtSource.close()
        return
      }

      const incomingArr = JSON.parse(alert.data)

      if (incomingArr.length > allMessages.length)
      {
        sortAndSetMessages(incomingArr)
      }

    })

    return () => {
      toast.dismiss()
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
      toast.error(`${dup} is invalid: ${errorMessage}`)
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
              {
                roomState !== ChatStates.DEAD && 
                <Countdown date={chatDetails.expiresAt} />
              }
              {
                roomState === ChatStates.DEAD && 
                <div>Game Over</div>
              }
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

        {
          roomState !== ChatStates.DEAD && 
          <form 
            className={"chat-form "}
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
        }

        {
          roomState === ChatStates.DEAD &&
          <div className="chat-play-again jersey-15 button unselectable"
            onClick={startNewGame}
          >
            Play again 
          </div>
        }

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

      {
        victory && 
        <Confetti recycle={false} numberOfPieces={3000} initialVelocityY={30} tweenDuration={100000}/>
      }

    </div>
  )

}

export default Chat;
