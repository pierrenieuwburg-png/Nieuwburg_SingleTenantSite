import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  FaHome, FaCalendarAlt, FaFileInvoice, FaWallet, 
  FaUserCircle, FaSignOutAlt, FaMapMarkerAlt, FaUsers, FaGift, FaCreditCard 
} from 'react-icons/fa';
import './ClientSidebar.css';

const ClientSidebar = ({ isOpen }) => {
  return (
    <div className={`client-sidebar ${isOpen ? 'mobile-open' : ''}`}>
      
      {/* SECTION 1: MAIN */}
      <div className="sidebar-section">
        <nav className="sidebar-nav">
          <NavLink to="/client/dashboard" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FaHome /> Dashboard
          </NavLink>
          <NavLink to="/client/dashboard/quotes" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FaFileInvoice /> Quotes & Requests
          </NavLink>
          <NavLink to="/client/dashboard/bookings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FaCalendarAlt /> My Bookings
          </NavLink>
          <NavLink to="/client/dashboard/partners" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FaUsers /> Blitz Partners
          </NavLink>
        </nav>
      </div>

      {/* SECTION 2: ACCOUNT */}
      <div className="sidebar-section">
        <nav className="sidebar-nav">
          <NavLink to="/client/dashboard/wallet" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FaWallet /> Wallet & Rewards
          </NavLink>
          <NavLink to="/client/dashboard/payments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FaCreditCard /> Payments
          </NavLink>
          <NavLink to="/client/dashboard/locations" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FaMapMarkerAlt /> My Locations
          </NavLink>
          <NavLink to="/client/dashboard/vouchers" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FaGift /> Vouchers
          </NavLink>
          <NavLink to="/client/dashboard/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FaUserCircle /> My Profile
          </NavLink>
        </nav>
      </div>

      <div className="sidebar-footer">
        <a href="/auth/logout" className="nav-item logout">
            <FaSignOutAlt /> Sign Out
        </a>
      </div>
    </div>
  );
};

export default ClientSidebar;