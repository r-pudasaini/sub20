import React from 'react'
import '../assets/css/global.css'
import '../assets/css/Game.css'
import MoonLoader from 'react-spinners/MoonLoader'


function Game() {

  // TODO: make a buffering GIF right here

  return (
    <div className='margin-top flex-col center-contents-vertical'>

      <div className='game-buffering'>

        <MoonLoader
          color={"white"}
          size={50}
          fadeSpeed={1}
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