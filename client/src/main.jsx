import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import axios from 'axios'

// Set the global default base URL for all API requests
axios.defaults.baseURL = import.meta.env.VITE_API_URL || '';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('ServiceWorker registration successful');
      },
      (err) => {
        console.log('ServiceWorker registration failed: ', err);
      }
    );
  });
}
