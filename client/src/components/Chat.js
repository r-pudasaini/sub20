import { useContext, useEffect, useState } from "react";
import '../assets/css/global.css'
import '../assets/css/Chat.css'
import { toast, Zoom } from "react-toastify";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Chatroom } from "../contexts/ChatroomContext";
import { Login } from "../contexts/LoginContext";
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
  const {userDetails} = useContext(Login)

  const [copyMessage, setCopyMessage] = useState(chatDetails.transitMessage || "")  // a copy message which is displayed for the user
  const [allMessages, setAllMessages] = useState( (chatDetails.messages || []).sort( (m1, m2) => m2.time - m1.time))  // an array of all the messages in the room 
  const [roomState, setRoomState] = useState(chatDetails.state || "YOUR_TURN") // the state of the room right now (our turn, waiting for partner, or game over)
  const [countdownTime, setCountdownTime] = useState(chatDetails.expiresAt || 0)

  const [message, setMessage] = useState("")  // the message as we type it 
  const [victory, setVictory] = useState(false) // whether we won or not to display some confetti 
  const [popup, setPopup] = useState(false) // the rules popup 

  const verifyMessage = (message) => {

    if (message.length === 0)
    {
      return "Message must not be empty"
    }

    if (message.length > 50)
    {
      return "Message must not be longer than 50 characters" 
    }

    const alphabet = 'abcdefghijklmnopqrstuvwxyzQWERTYUIOPASDFGHJKLZXCVBNM'.split('');
    let space = false

    for (let char of message)
    {
      if (char === ' ')
      {
        if (space)
        {
          return "Message must not have more than one space"
        }
        space = true
        continue;
      }

      if (!alphabet.includes(char))
      {
        return "Invalid character found in message"
      }
    }

    let lowercaseArr = allMessages.map((msg) => {
      return msg.text.toLocaleLowerCase()
    })

    if (lowercaseArr.includes(message.toLocaleLowerCase()))
    {
      return `${message} has already been sent` 
    }

    return ""
  }

  useEffect(() => {

    setChatDetails({...chatDetails, messages: allMessages, state: roomState, transitMessage: copyMessage, expiresAt:countdownTime})

  }, [roomState, allMessages, setChatDetails, copyMessage, countdownTime])

  const navigate = useNavigate()


  const getMessageType = (uid) => {

    if (uid === userDetails.sub)
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
    else if (uid === 'server-first-category')
    {
      return 'chat-message-server-first-bold'
    }
    return "chat-message-other"
  }

  const sortAndSetMessages = (messageArray) => {

    messageArray.sort((m1, m2) => {
      return m2.time - m1.time
    })

    setRoomState(ChatStates.YOUR_TURN)
    setAllMessages(messageArray)
  }

  const leaveRoom = () => {
    axios.get('/api/unregister-player').then((_) => {

      setChatDetails({})
      navigate('/')

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


    if (!userDetails)
    {
      //navigate('/error/401')
      return
    }

    const evtSource = new EventSource("/api/get-chatroom-messages");

    evtSource.addEventListener('error', (error) => {
      console.log(error)
    })

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
      else if (alert.data.startsWith('extra time/'))
      {
        const expirationTime = parseInt(alert.data.substring('extra time/'.length))
        setCountdownTime(expirationTime)
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

  }, [userDetails, navigate])

  const handleSubmit = (e) => {

    e.preventDefault()

    if (roomState !== ChatStates.YOUR_TURN)
    {
      return
    }

    const dup = String(message)

    const errorMessage = verifyMessage(dup)

    if (errorMessage)
    {
      toast.dismiss()
      toast.error(`${errorMessage}`, {autoClose: false})
      return;
    }

    setCopyMessage(dup)
    axios.post('/api/send-chatroom-message', {"message":dup}).then((_) => {

      toast.dismiss()
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
                <Countdown date={countdownTime} />
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
          <div className="flex-row">
            <div className="chat-leave jersey-15 button unselectable"
              onClick={leaveRoom}
            >
              Leave 
            </div>

            <div className="chat-play-again jersey-15 button unselectable"
              onClick={startNewGame}
            >
              Play again 
            </div>
          </div>
        }

        {
          roomState !== ChatStates.DEAD &&
          <div 
            className="chat-rules-popup"
            onClick={() => setPopup(true)}
          >
            Rules
          </div>
        }

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
            Your Message: 
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
