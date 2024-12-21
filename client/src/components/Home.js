import React, { useState } from 'react'
import {useNavigate} from 'react-router-dom'
import '../assets/css/global.css'
import '../assets/css/Home.css'
import How2PlayPopup from './HowToPlayPopup'
import Cookies from 'universal-cookie'
import {signInWithPopup} from 'firebase/auth'
import {toast} from 'react-toastify'
import {auth, provider} from '../firebase-config'

export const cookies = new Cookies()

function Home() {

  const [how2playPopup, setHow2PlayPopup] = useState(false)

  const navigate = useNavigate()

  const handleLogin = async () => {

    if (typeof(cookies.get("auth_token")) !== "undefined")
    {
      toast.error("You are already Logged in!")
      return
    }

    try {
      const result = await signInWithPopup(auth, provider)
      const token = await result.user.getIdToken();
      cookies.set("auth_token", token)
    } catch (error) {
      console.error(error)
      toast.error('Failed to sign in. Please try again later.')
    }
  }

  const handleStartGameClick = () => {

    if (typeof(cookies.get("auth_token")) === "undefined")
    {
      toast.error('Must be logged in to play.')
    }
    else
    {
      navigate('start-game')
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
          className="home-login-button unselectable button"
          onClick={handleLogin}
        >
          <img
            src={require('../assets/images/light-sign-in.png')}
            width="200px"
            height="auto"
            alt='Google Sign In button'
          />
        </div>


      </div>

      <div className="home-button-row">
        <div
          className="home-start-game-button unselectable jersey-15-regular button"
          onClick={handleStartGameClick}
        >
          Find Me a Game
        </div>
      </div>

      <How2PlayPopup isActive={how2playPopup} setState={setHow2PlayPopup} />

    </div>
  )
}

export default Home;