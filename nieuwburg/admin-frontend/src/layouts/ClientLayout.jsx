import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import ClientSidebar from '../components/client/ClientSidebar';
import ClientHeader from '../components/client/ClientHeader';
import './ClientLayout.css';

const ClientLayout = () => {
  // State is now strictly for MOBILE menu toggling
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleSidebar = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="client-layout">
      {/* Sidebar is always visible on desktop, toggles on mobile */}
      <ClientSidebar isOpen={isMobileMenuOpen} />

      <div className="client-main-content">
        {/* Header needs toggle for mobile view */}
        <ClientHeader toggleSidebar={toggleSidebar} />
        
        <div className="client-page-container">
          <Outlet /> 
        </div>
      </div>
    </div>
  );
};

export default ClientLayout;