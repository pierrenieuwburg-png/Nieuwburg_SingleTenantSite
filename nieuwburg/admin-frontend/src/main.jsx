import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import MasterApp from './MasterApp.jsx';
import './App.css';

// 1. Check which portal we are in
const adminRoot = document.getElementById('admin-app-root');
const clientRoot = document.getElementById('root');
const masterRoot = document.getElementById('master-app-root');

// 2. Render the correct context
if (masterRoot) {
  // --- MASTER-ADMIN (PLATFORM) AREA ---
  // Mounts to: templates/master/master_base.html
  ReactDOM.createRoot(masterRoot).render(
    <React.StrictMode>
      <BrowserRouter basename="/master-admin">
        <MasterApp />
      </BrowserRouter>
    </React.StrictMode>
  );
} else if (adminRoot) {
  // --- ADMIN OR STAFF PORTAL ---
  // Dynamically set the basename depending on which URL triggered the shell
  const isStaffApp = window.location.pathname.startsWith('/staff-app');
  const base = isStaffApp ? '/staff-app' : '/admin';

  ReactDOM.createRoot(adminRoot).render(
    <React.StrictMode>
      <BrowserRouter basename={base}>
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
} else if (clientRoot) {
  // --- CLIENT PORTAL ---
  // Mounts to: templates/client/client_dashboard.html
  ReactDOM.createRoot(clientRoot).render(
    <React.StrictMode>
      <BrowserRouter basename="/">
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
} else {
  console.error("React Root Not Found: Checked 'admin-app-root' and 'root'");
}