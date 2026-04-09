import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@popclozet/auth';
import { ToastProvider } from './contexts/ToastContext';
import { LocationProvider } from './contexts/LocationContext';
import App from './App';
import { UpdatePrompt } from './components/pwa/UpdatePrompt';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ToastProvider>
          <LocationProvider>
            <App />
            <UpdatePrompt />
          </LocationProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
