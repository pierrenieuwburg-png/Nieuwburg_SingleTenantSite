import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import ClientSidebar from '../components/client/ClientSidebar';
import ClientHeader from '../components/client/ClientHeader';
import './ClientLayout.css';

const ClientLayout = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleSidebar = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="client-layout">
      <ClientSidebar isOpen={isMobileMenuOpen} />
      <div className="client-main-content">
        <ClientHeader toggleSidebar={toggleSidebar} />
        <div className="client-page-container">
          <Outlet />
        </div>
      </div>
    </div>
  );
};

export default ClientLayout;