import './css/dashboard.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

document.title = "Oraculo";
const observer = new MutationObserver(() => {
  if (document.title !== "Oraculo") {
    document.title = "Oraculo";
  }
});
const titleEl = document.querySelector('title');
if (titleEl) {
  observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);