import React from 'react'
import '../assets/css/global.css'
import '../assets/css/NotFound.css'
import searchFail from '../assets/images/search_not_found.png'

function NotFound() {
  return (
    <div className='flex-col center-contents-vertical'>

      <div className='not-found-image'>
        <img 
          src={searchFail}
          alt="Page not found"
          className="unselectable"
          width="400px"
          height="auto"
        >

        </img>
      </div>

      <div className='not-found-text jersey-15-regular'>
        Page Not Found
      </div>

    </div>
  )
}

export default NotFound;