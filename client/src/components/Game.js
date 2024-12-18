import React, { useContext } from 'react'
import '../assets/css/global.css'
import '../assets/css/Game.css'
import MoonLoader from 'react-spinners/MoonLoader'
import { Login } from '../contexts/LoginContext'
import GameRedirect from './GameRedirect'

function Game() {

  // TODO: make sure the login value is not false 
  // if it is false, then we need to display that they must be logged in 
  // to play the game, and they'll be re-directed to the home page after a 3-5 second delay

  const {isLoggedIn} = useContext(Login)

  return (isLoggedIn) ? (
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
  ) : (
    <GameRedirect />
  )
}

export default Game;