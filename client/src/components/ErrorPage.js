import '../assets/css/global.css'
import '../assets/css/ErrorPage.css'
import React, { useState, useEffect, useContext } from 'react'
import { useNavigate, Link, useParams } from 'react-router-dom'
import { Login } from '../contexts/LoginContext'
import { auth } from '../firebase-config'
import {signOut} from 'firebase/auth'

const codes2message = {
  "" : "Page Not Found\n",
  "401" : "Attempt to access chat room without authentication, or with expired credentials. Please log in and try again\n",
  "403" : "Attempt to access chat room without valid permissions\n",
  "404" : "Page Not found\n",
}


function ErrorPage() {

  const navigate = useNavigate()

  const {code} = useParams()

  const [eCode, setECode] = useState("")
  const {setLoginCookie} = useContext(Login)

  useEffect(() => {
    setTimeout(() => {
      navigate('/')
    }, 5000)
  }, [navigate])

  useEffect(() => {

    if (code in codes2message)
    {
      setECode(code)
    }

    // if the error is 401, we will set loggedIn to be false. 
    if (code === "401")
    {
      signOut(auth).then(() => {
        setLoginCookie("")
      }).catch((error) => {
        console.log(`Sign out error: ${error}`)
        setLoginCookie("")
      });
    }


  }, [code, setLoginCookie])


  return (
    <div className='margin-top flex-col center-contents-vertical'>
      <div className='error-text jersey-15-regular'>
        Error: {eCode} {codes2message[eCode]}
        <br/>
        Click <Link to='/'> Here </Link> if you are not redirected back home automatically
      </div>
    </div>
  )

}

export default ErrorPage;