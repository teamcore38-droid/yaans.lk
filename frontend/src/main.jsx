import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { prefetchPage } from './utils/navigation.js';

// Start the route chunk and its data together, before React mounts the page.
prefetchPage(`${window.location.pathname}${window.location.search}`);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
