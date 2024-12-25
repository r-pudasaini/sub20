import '../assets/css/Popup.css'
import '../assets/css/Logout.css'
import { useContext } from 'react'
import '../assets/css/global.css'
import {signOut} from 'firebase/auth'
import {toast} from 'react-toastify'
import {auth} from '../firebase-config'
import { Login } from '../contexts/LoginContext'

function LogoutPopup({isActive, setState}) {

    const {setLoginCookie} = useContext(Login)

    const handleLogout = () => {
        signOut(auth).then(() => {
            setLoginCookie("")
            toast.success("Logged Out!")
        }).catch((error) => {
            setLoginCookie("")
            //toast.error("Error Signing Out. Please try again later. ")
            console.log(`Logout error: ${error}`)
        });

        setState(false)
    }

    return (isActive) ? (
        <div className="popup">

            <div className="popup-card flex-col">

                <i
                    className="close-button fa-solid fa-x"
                    onClick={() => setState(false)}>
                </i>

                <div className="center-text jersey-15-large logout-header">
                    Are you sure you want to Log Out?
                </div>

                <div className="logout-display-name center-text">
                    Signed in as: {auth.currentUser.displayName} ({auth.currentUser.email})
                </div>

                <div className="logout-popup-button-row flex-row">

                    <div className="logout-popup-cancel button jersey-15-regular"
                        onClick={() => setState(false)}
                    >
                        Cancel
                    </div>

                    <div className="logout-popup-confirm button jersey-15-regular"
                        onClick={handleLogout}
                    >
                       Yes, log me out 
                    </div>


                </div>

            </div>

        </div>
    ) : <></>;
}

export default LogoutPopup;