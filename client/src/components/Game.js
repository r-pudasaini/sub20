import React, { useContext, useEffect } from 'react'
import '../assets/css/global.css'
import '../assets/css/Game.css'
import MoonLoader from 'react-spinners/MoonLoader'
import {useNavigate} from 'react-router-dom'
import axios from 'axios'
import {Chatroom} from '../contexts/ChatroomContext'

function Game() {

  const navigate = useNavigate()
  const {setChatDetails} = useContext(Chatroom)

  useEffect(() => {

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