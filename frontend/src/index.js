import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppRoutes from './Routes';
import { Toaster } from 'sonner';
import { registerServiceWorker, setupInstallPrompt } from './pwa';

setupInstallPrompt();
registerServiceWorker();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AppRoutes />
    <Toaster position="top-center" richColors />
  </React.StrictMode>
);