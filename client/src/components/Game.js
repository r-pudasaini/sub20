import React, { useContext, useEffect } from 'react'
import '../assets/css/global.css'
import '../assets/css/Game.css'
import MoonLoader from 'react-spinners/MoonLoader'
import {useNavigate} from 'react-router-dom'
import axios from 'axios'
import { toast } from 'react-toastify'
import {Chatroom} from '../contexts/ChatroomContext'

function Game() {

  const navigate = useNavigate()
  const {setChatDetails} = useContext(Chatroom)

  useEffect(() => {

    // here, we will make a request to the server for a game room resource. 
    // the server will authenticate the request iff we are logged in, and the auth-token cookie is a valid firebase JWT 
    // the server will give a 401 if there wasn't such a cookie or if the cookie was invalid,
    // and we will handle the 401 by navigating to the Error Page and displaying the according error message. 

    // the server will respond with 200 OK, and the chat room id of the current player if they are logged in. This chat room id must be saved 
    // as a cookie. 

    // if the user already belongs to a chatroom, they will be directed to a page with the messages of their chat-room open 

    // if the user does not belong to a chatroom, they will be placed into a Queue until another player joins the room with them. 
    // when a partner player is found, the user will be directed to the chatroom page. 

    toast.dismiss()

    axios.get('/api/start-game').then((response) => {

      setChatDetails(response.data)
      navigate('/chat-page')

    }).catch((error) => {

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

  }, [navigate, setChatDetails])

  return (
    <div className='margin-top flex-col center-contents-vertical'>

      <div className='game-buffering'>
        <MoonLoader
          color={"white"}
          size={50}
          speedMultiplier={0.75}
        />
      </div>

      <div className='game-state-text jersey-15-regular'>
        Searching for a player...
      </div>

    </div>
  )
}

export default Game;