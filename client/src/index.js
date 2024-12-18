import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import LoginContext from './contexts/LoginContext';
import App from './App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <LoginContext>
      <App />
    </LoginContext>
  </React.StrictMode>
);
