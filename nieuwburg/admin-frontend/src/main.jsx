import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './App.css';

// 1. Check which portal we are in
const adminRoot = document.getElementById('admin-app-root');
const clientRoot = document.getElementById('root');

// 2. Render the correct context
if (adminRoot) {
  // --- ADMIN PORTAL ---
  // Mounts to: templates/admin/admin_base.html
  // Basename: /admin (so internal routes like '/dashboard' match '/admin/dashboard')
  ReactDOM.createRoot(adminRoot).render(
    <React.StrictMode>
      <BrowserRouter basename="/admin">
        <App />
      </BrowserRouter>
    </React.StrictMode>
  );
} else if (clientRoot) {
  // --- CLIENT PORTAL ---
  // Mounts to: templates/client/client_dashboard.html
  // Basename: / (so internal routes like '/client/dashboard' match full URL)
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