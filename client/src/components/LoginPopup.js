import {auth, provider} from '../firebase-config'
import '../assets/css/Popup.css'
import '../assets/css/global.css'
import {signInWithPopup} from 'firebase/auth'
import Cookies from 'universal-cookie'
import { useContext } from 'react'
import { Login } from '../contexts/LoginContext'
import { useNavigate } from 'react-router-dom'
import {toast} from 'react-toastify'

const cookies = new Cookies()

function LoginPopup({isActive, setState}) {

  const {changeLogin} = useContext(Login)
  const navigate = useNavigate()

  const handleLogin = async () => {

    try {
      const result = await signInWithPopup(auth, provider)
      cookies.set("auth-token", result.user.refreshToken)
      changeLogin(true)
      setState(false)
      navigate('/start-game')

    } catch (error) {
      console.error(error)
      // TODO: create a react toast that notifies the user that an error occurred. 
      toast.error('Failed to sign in. Please try again later.')
    }
  }

  return (isActive) ? (
    <div className="popup">
      <div className="popup-card">
        <i
          className="close-button fa-solid fa-x"
          onClick={() => setState(false)}>
        </i>

        <div className="text-box">
          <h1 className="jersey-15-large">
            Log in to Play
          </h1>

          <button 
            className="button"
            onClick={handleLogin}
          > 
            Sign in with Google
          </button>


        </div>
      </div>
    </div>
  ) : <></>;
}

export default LoginPopup;