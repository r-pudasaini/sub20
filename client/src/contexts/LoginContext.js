import { createContext, useEffect, useState } from "react";
import { cookies } from "../cookie";
import {jwtDecode} from 'jwt-decode'

export const Login = createContext({
  loginCookie: "", 
  userDetails: "",
  setLoginCookie: () => null
})

Login.displayName = 'LoginContext'

function LoginContext ({children}) {

  const [loginCookie, setLoginCookie] = useState(cookies.get("auth_token"))
  const [userDetails, setUserDetails] = useState("")

  useEffect(() => {

    if (!loginCookie)
    {
      cookies.remove("auth_token")
      return
    }

    try {
      const ud = jwtDecode(loginCookie)

      //console.log(ud)

      if (!ud.exp)
      {
        console.log("no expiration found")
        throw Error("no expiration")
      }

      //console.log("expires: " + ud.exp)
      //console.log("now: " + Date.now())

      if (Date.now() > ud.exp * 1000)
      {
        throw Error("expired")
      }

      setUserDetails(ud)

      cookies.set("auth_token", loginCookie, {
        sameSite:"strict"
      })

    }
    catch (_)
    {
      cookies.remove("auth_token")
      setUserDetails("")
    }

  }, [loginCookie])

  return (
    <Login.Provider value={{loginCookie, setLoginCookie, userDetails}}>{children}</Login.Provider>
  );
}

export default LoginContext;