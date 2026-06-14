import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './ClientHeader.css';

const ClientHeader = ({ toggleSidebar }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="client-top-header">
      {/* 1. Left Side: Toggle + Logo */}
      <div className="header-brand-area">
        <Link to="/client/dashboard" className="header-logo-link">
            <img src="/static/img/LogoBlackWithTitle.png" alt="Nieuwburg Blitz" className="header-logo" />
        </Link>
      </div>

      {/* 2. Spacer */}
      <div className="header-spacer"></div>

      {/* 3. Right Side: Profile */}
      <div className="header-profile-container" ref={dropdownRef}>
        <div 
          className="profile-circle" 
          onClick={() => setShowDropdown(!showDropdown)}
        >
          {/* Placeholder for user image */}
          <img src="/static/img/avatar_picture_profile_user_icon.png" alt="Profile" />
        </div>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="profile-dropdown">
            <div className="dropdown-header">
              <strong>My Account</strong>
              <small>Client Access</small>
            </div>
            <Link to="/client/dashboard/profile" className="dropdown-item" onClick={() => setShowDropdown(false)}>
              Edit Profile
            </Link>
            <div className="dropdown-divider"></div>
            <a href="/auth/logout" className="dropdown-item text-red">
              Logout
            </a>
          </div>
        )}
      </div>
    </header>
  );
};

export default ClientHeader;