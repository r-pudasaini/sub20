import React, { useState } from 'react'
import {useNavigate} from 'react-router-dom'
import '../assets/css/global.css'
import '../assets/css/Home.css'
import How2PlayPopup from './HowToPlayPopup'
import LoginPopup from './LoginPopup'
import Cookies from 'universal-cookie'

function Home() {

  const [how2playPopup, setHow2PlayPopup] = useState(false)
  const [loginPopup, setLoginPopup] = useState(false)

  const navigate = useNavigate()
  const cookies = new Cookies()

  const handleStartGameClick = () => {

    if (typeof(cookies.get('auth-token')) === "undefined")
    {
      setLoginPopup(true) // prompt the user to log in
    }
    else
    {
      navigate('/start-game')
    }
  }

  return (
    <div className='margin-top flex-col center-contents-vertical'>

      <div className='home-logo pixelify-sans-regular unselectable'>
        Sub 20
      </div>

      <div className="home-button-row flex-row">

        <div 
          className="home-how-to-play-button unselectable jersey-15-regular button"
          onClick={() => setHow2PlayPopup(true)}
        >
          How to Play?
        </div>

        <div
          className="home-start-game-button unselectable jersey-15-regular button"
          onClick={handleStartGameClick}
        >
          Find Me a Game
          {/*
            TODO: when we have support for google authentication, make the button say "Login to Play" if not signed in, 
            and "Find me a Game if we are signed in."
          */}
        </div>

      </div>

      <How2PlayPopup isActive={how2playPopup} setState={setHow2PlayPopup} />
      <LoginPopup isActive={loginPopup} setState={setLoginPopup} />

    </div>
  )
}

export default Home;