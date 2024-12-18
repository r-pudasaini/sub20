import '../assets/css/global.css'
import '../assets/css/Game.css'
import React, { useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'

function GameRedirect() {

  const navigate = useNavigate()

  useEffect(() => {
    setTimeout(() => {
      navigate('/')
    }, 2000)
  })

  return (
    <div className='margin-top flex-col center-contents-vertical'>
      <div className='game-state-text jersey-15-regular'>
        Error, you must be logged in to access the chatrooms
        Click <Link to='/'> Here </Link> if you are not redirected automatically
      </div>
    </div>
  )

}

export default GameRedirect;