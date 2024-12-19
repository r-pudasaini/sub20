import { useEffect } from "react";
import '../assets/css/global.css'
import { toast } from "react-toastify";
import axios from "axios";


function Chat() {

  useEffect(() => {

    axios.get('/api/get-chatroom').then((response) => {

      // TODO: response will have the most recent chat messages, we will display these
      // as the game progresses. 

    }).catch((error) => {
      console.log(error)
      toast.error(error.response.data)
    })

  }, [])

  return (
    <div className="center-text margin-top jersey-15-large">
      Wow, such an empty chat page. 
    </div>
  )

}

export default Chat;