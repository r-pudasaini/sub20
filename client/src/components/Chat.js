import { useEffect } from "react";
import '../assets/css/global.css'
import { toast } from "react-toastify";
import axios from "axios";


function Chat() {

  // TODO: response will have the most recent chat messages, we will display these
  // as the game progresses. 

  // we can do this using server-side events, and an event source. 
  // the server will maintain its own database of chat-rooms, registered users, and messages in each chatroom. 
  // when a user is logged in and authenticated, they will recieve live updates from the server regarding the 
  // state of the chat-room the client is in. These messages will be properly rendered for the user, by us (client code)

  // so we can encapsulate all the document-related logic on the server, and let the client only send messages it wants the server to 
  // have through some api endpoint, and recieve messages from another api endpoint. 


  return (
    <div className="center-text margin-top jersey-15-large">
      Wow, such an empty chat page. 
    </div>
  )

}

export default Chat;