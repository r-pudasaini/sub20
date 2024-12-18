import './assets/css/global.css'
import Home from './components/Home'
import Game from './components/Game'
import NotFound from './components/NotFound'
import 'react-toastify/dist/ReactToastify.css'
import {Flip, ToastContainer} from 'react-toastify'

import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom"


function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/start-game" element={<Game />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <ToastContainer
        position="bottom-right"
        autoClose={1000}
        hideProgressBar={true}
        stacked={true}
        limit={100}
        transition={Flip}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme={"dark"}
      />
    </Router>
  );
}

export default App;
