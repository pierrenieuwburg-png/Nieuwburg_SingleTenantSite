import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

// We now only accept an `onDelete` prop
function ActionsDropdown({ quote, onDelete }) {
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  const handleDeleteClick = () => {
    // The parent (Quotes.jsx) already knows how to pass the type
    onDelete(); 
    setIsOpen(false);
  };

  return (
    <div className="actions-dropdown-wrapper" ref={wrapperRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="cta-outline-small actions-btn"
      >
        Actions <span style={{fontSize: '0.8em', marginLeft: '4px'}}>&#9662;</span>
      </button>
      
      {isOpen && (
        <div className="actions-dropdown-menu">
          <Link to={quote.view_url} className="dropdown-item">
            View Details
          </Link>
          
          {/* --- THIS IS THE FIX --- */}
          {/* Only show Download for formal quotes */}
          {quote.type === 'quote' && (
            <a 
              href={`/api/admin/quotes/download/${quote.id}?type=${quote.type}`}
              className="dropdown-item"
              target="_blank" 
              rel="noopener noreferrer"
            >
              Download PDF
            </a>
          )}
          {/* --- END OF FIX --- */}
          
          <div style={{ borderTop: '1px solid #eee', margin: '4px 0' }}></div>
          <button
            onClick={handleDeleteClick}
            className="dropdown-item dropdown-item-delete"
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

export default ActionsDropdown;