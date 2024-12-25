import '../assets/css/Popup.css'
import '../assets/css/HowToPlay.css'
import '../assets/css/global.css'

function HowToPlayPopup({isActive, setState}) {

    return (isActive) ? (
        <div className="popup">

            <div className="popup-card">
                <i
                    className="close-button fa-solid fa-x"
                    onClick={() => setState(false)}>
                </i>

                <div className="text-box">
                    <h1 className="jersey-15-large">
                        How to Play
                    </h1>

                    <div className="how-to-play-instruction-container flex-col center-contents-vertical">

                        <div>
                            <p className="title-font how-to-play-text">
                                1: Sign in with Google and Join a Game with a random partner
                            </p>
                        </div>

                        <div className="flex-col center-contents-vertical">
                            <p className="title-font how-to-play-text">
                                2: Wait until you see a chat page like below
                            </p>

                            <img
                                src={require('../assets/images/how2play-chat-page.png')}
                                alt="Chat window"
                                height="auto"
                                width="50%"
                            />

                        </div>

                        <div className="flex-col center-contents-vertical">
                            <p className="title-font how-to-play-text">
                                3: Try to send the same message as them: 
                            </p>
                            <img
                                src={require('../assets/images/how2play-sample-room.png')}
                                alt="Sample chat room"
                                height="auto"
                                width="50%"
                            />

                        </div>

                        <div className="flex-col center-contents-vertical">
                            <p className="title-font how-to-play-text">
                                4: You get 20 rounds, and 10 minutes max to send the same thing.
                            </p>
                        </div>

                        <div className="flex-col center-contents-vertical">
                            <p className="title-font how-to-play-text">
                                5: Try to send messages belonging to your category 
                            </p>

                            <div className="flex-row center-contents-horizontal">
                                <img
                                    src={require('../assets/images/how2play-dos-and-donts.png')}
                                    alt="Acceptable and unacceptable messages"
                                    height="auto"
                                    width="50%"
                                />

                            </div>
                        </div>
                        <div className="flex-col center-contents-vertical">
                            <p className="title-font how-to-play-text how-to-play-rule-line">
                                6: Message Rules
                            </p>

                            <ul>
                                <li>
                                    1 word per message
                                </li>
                                <li>
                                    Alphabet Characters only
                                </li>
                                <li>
                                    No empty Messages
                                </li>
                                <li>
                                    No messages that have already been sent
                                </li>
                            </ul>

                        </div>

                    </div>

                </div>
            </div>
        </div>
    ) : <></>;
}

export default HowToPlayPopup;