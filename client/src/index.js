import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import LoginContext from './contexts/LoginContext'
import ChatroomContext from './contexts/ChatroomContext'

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <LoginContext>
      <ChatroomContext>
        <App />
      </ChatroomContext>
    </LoginContext>
  </React.StrictMode>
);
