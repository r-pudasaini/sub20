import React from 'react'
import {Link} from 'react-router-dom'
import '../assets/css/global.css'
import '../assets/css/Home.css'

function Home() {

  const how2PlayPopup = () => {
    // TODO: display the how to play popUp by invoking this function. 
  }

  return (
    <div className='margin-top flex-col center-contents-vertical'>

      <div className='home-logo pixelify-sans-regular unselectable'>
        Sub 20
      </div>

      <div className="home-button-row flex-row">

        <div 
          className="home-how-to-play-button unselectable jersey-15-regular button"
          onClick={how2PlayPopup}
        >
          How to Play?
        </div>

        <Link 
          to="start-game" 
          className="home-start-game-button unselectable jersey-15-regular button"
        >
          Find Me a Game
        </Link>

      </div>

      <div>

      </div>

    </div>
  )
}

export default Home;