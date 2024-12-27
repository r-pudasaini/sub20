import { createContext, useEffect, useState } from "react";

export const Chatroom = createContext({
  chatDetails: {},
  setChatDetails: () => null
})

Chatroom.displayName = 'ChatContext'
const CHAT_STORAGE_KEY = 'sub20.chatroom.storage-key'


function ChatroomContext ({children}) {

  const initialState = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || '{}')

  const [chatDetails, setChatDetails] = useState(initialState)

  useEffect(() => {

    if(Object.keys(chatDetails).length === 0)
    {
      localStorage.removeItem(CHAT_STORAGE_KEY)
    }
    else
    {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatDetails))
    }

  }, [chatDetails, setChatDetails])

  return (
    <Chatroom.Provider value={{chatDetails, setChatDetails}}>{children}</Chatroom.Provider>
  );
}

export default ChatroomContext;