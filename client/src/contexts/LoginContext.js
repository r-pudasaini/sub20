import { createContext, useState } from "react";
import Cookies from "universal-cookie";

export const Login = createContext({
  isLoggedIn : false, 
  changeLogin: () => null
})

Login.displayName = 'LoginContext'

function LoginContext ({children}) {

  const cookie = new Cookies()
  const [login, setLogin] = useState(cookie.get('auth-token'))

  return (
    <Login.Provider value={{isLoggedIn:login, changeLogin:setLogin}}>{children}</Login.Provider>
  );
}

export default LoginContext;