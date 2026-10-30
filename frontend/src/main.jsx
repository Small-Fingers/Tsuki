import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/base.css';
import './styles/features/account.css';
import './styles/features/admin.css';
import './styles/features/buyer.css';
import './styles/features/interactions.css';
import './styles/features/marketplace.css';
import './styles/features/seller.css';
import App from './app/App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
