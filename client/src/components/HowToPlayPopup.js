import '../assets/css/Popup.css'
import '../assets/css/HowToPlay.css'
import '../assets/css/global.css'
import { useState } from 'react'

import how2play1 from '../assets/images/how2play-1.png'
import how2play2 from '../assets/images/how2play-2.png'
import how2play3 from '../assets/images/how2play-3.png'
import how2play4 from '../assets/images/how2play-4.png'
import how2play5 from '../assets/images/how2play-5.png'

function HowToPlayPopup({isActive, setState}) {

    const [index, setIndex] = useState(0)

    const images = [
        how2play1,
        how2play2,
        how2play3,
        how2play4,
        how2play5,
    ]

    const altText = [
        'Sign in with google, then click the green button to play',
        'When a partner is found, you should see an chatroom in front of you. You are trying to send the same message as them',
        'Your messages are white, your partner\'s messages are grey, and server messages are yellow',
        'The first message in each chatroom is your assigned category. Send messages that belong to your category',
        'You can only send one word at a time, alphabet characters only, non-empty messages, messages distinct from others previously submitted. You have 10 minutes, and 20 guesses.',
    ]

    const leftPress = () => {
        if (index > 0)
        {
            setIndex(index - 1)
        }
    }

    const rightPress = () => {
        if (index < images.length - 1)
        {
            setIndex(index + 1)
        }
    }

    const handleKeyDown = (event) => {
        if (event.key === "ArrowLeft")
        {
            leftPress()
        }
        else if (event.key === "ArrowRight")
        {
            rightPress()
        }
    }

    return (isActive) ? (
        <div className="popup" tabIndex={0} onKeyDown={handleKeyDown}>

            <div className="popup-card">
                <i
                    className="close-button fa-solid fa-x"
                    onClick={() => setState(false)}>
                </i>

                <div className="popup-page-number">
                    {index + 1} / 5
                </div>

                <div className="popup-elements">

                    <i 
                        className="fa-solid fa-chevron-left popup-prev"
                        onClick={leftPress}
                    />

                    <img
                        src={images[index]}
                        alt={altText[index]}
                        width="80%"
                        height="auto"
                    />

                    <i 
                        className="fa-solid fa-chevron-right popup-next"
                        onClick={rightPress}
                    />

                </div>


            </div>
        </div>
    ) : <></>;
}

export default HowToPlayPopup;