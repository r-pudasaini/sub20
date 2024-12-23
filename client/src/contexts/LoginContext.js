import { createContext, useEffect, useState } from "react";
import { cookies } from "../cookie";

export const Login = createContext({
  loginCookie: "", 
  setLoginCookie: () => null
})

Login.displayName = 'LoginContext'

function LoginContext ({children}) {

  const [loginCookie, setLoginCookie] = useState(cookies.get("auth_token"))


  useEffect(() => {

    if (!loginCookie)
    {
      cookies.remove("auth_token")
    }
    else
    {
      cookies.set("auth_token", loginCookie, {
        sameSite:"strict"
      })
    }

  }, [loginCookie])

  return (
    <Login.Provider value={{loginCookie, setLoginCookie}}>{children}</Login.Provider>
  );
}

export default LoginContext;