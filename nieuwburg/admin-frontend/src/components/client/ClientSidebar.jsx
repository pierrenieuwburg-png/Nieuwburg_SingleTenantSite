import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  FaHome, FaCalendarAlt, FaFileInvoice, FaWallet,
  FaUserCircle, FaSignOutAlt, FaUsers, FaCreditCard
} from 'react-icons/fa';
import './ClientSidebar.css';

const ClientSidebar = ({ isOpen }) => {
  return (
    <div className={`client-sidebar ${isOpen ? 'mobile-open' : ''}`}>
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

      <div className="sidebar-section">
        <nav className="sidebar-nav">
          <NavLink to="/client/dashboard/wallet" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FaWallet /> Wallet & Rewards
          </NavLink>
          <NavLink to="/client/dashboard/payments" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FaCreditCard /> Payments
          </NavLink>
        </nav>
      </div>

      <div className="sidebar-footer">
        <NavLink to="/client/dashboard/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <FaUserCircle /> Profile & Settings
        </NavLink>
        <a href="/auth/logout" className="nav-item logout">
            <FaSignOutAlt /> Sign Out
        </a>
      </div>
    </div>
  );
};

export default ClientSidebar;