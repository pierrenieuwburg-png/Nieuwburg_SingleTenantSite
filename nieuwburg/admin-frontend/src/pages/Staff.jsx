import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AddStaffModal from '../components/AddStaffModal';

function Staff() {
  
  const [staffList, setStaffList] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const location = useLocation();
  const [flashMessage, setFlashMessage] = useState(null);

  // Debounce function (keep as is)
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  };

  // Function to fetch staff
  const fetchStaff = useCallback(async (query = '') => {
    console.log(`Staff Component: fetchStaff called with query: "${query}"`); // Log fetch call
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/staff/search?q=${encodeURIComponent(query)}`);
      console.log(`Staff Component: fetch response status: ${response.status}`); // Log response status
      if (!response.ok) {
        if (response.status === 403) throw new Error('Permission denied fetching staff.');
        throw new Error(`HTTP error fetching staff! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Staff Component: fetch successful, setting staff list.'); // Log success
      setStaffList(data);
    } catch (err) {
      console.error('Staff Component: Error fetching staff:', err); // Log error
      setError(`Error loading staff: ${err.message}`);
      setStaffList([]);
    } finally {
      console.log('Staff Component: fetch finished, setting isLoading to false.'); // Log finally block
      setIsLoading(false);
    }
  }, []); // useCallback depends on nothing external here, so empty array is correct

  // Debounced version for search input
  const debouncedFetchStaff = useCallback(debounce(fetchStaff, 300), [fetchStaff]); // Include fetchStaff as dependency for useCallback

  // Effect for initial load and search term changes
  useEffect(() => {
    // Log exactly when the effect runs and what the searchTerm is
    console.log(`Staff Component: useEffect triggered. Search Term: "${searchTerm}"`);
    debouncedFetchStaff(searchTerm);

  }, [searchTerm, debouncedFetchStaff]); // Keep dependencies as searchTerm and the debounced function

  // Effect to clear flash message (keep as is)
   useEffect(() => {
    if (flashMessage) {
       console.log('Staff Component: Flash message effect running.');
      const timer = setTimeout(() => setFlashMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [flashMessage]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };
  // --- Modal Control Functions ---
  const openAddStaffModal = () => setIsModalOpen(true);
  const closeAddStaffModal = () => setIsModalOpen(false);

  // --- Callback for when staff is added ---
  const handleStaffAdded = (message) => {
    setFlashMessage({ type: 'success', text: message }); // Show success message
    fetchStaff(searchTerm); // Refresh list respecting current search
  };

  // Function to get image URL (keep as is)
   const getImageUrl = (imageFilename) => {
       // ... (implementation remains the same) ...
        const defaultAvatar = '/static/img/avatar_picture_profile_user_icon.png';
    if (!imageFilename || imageFilename === 'avatar_picture_profile_user_icon.png') {
        return defaultAvatar;
    }
    return `/static/uploads/${imageFilename}`;
   };


  // --- Render Logic ---
  console.log('Staff Component: Preparing to render JSX');
  return (
    <div>
      {/* ... (rest of the JSX remains the same as the previous full version) ... */}
       <div className="admin-header">
        <h1>Staff Management</h1>
        <button type="button" className="cta" onClick={openAddStaffModal}>
          Add New Staff
        </button>
      </div>

      <div id="staff-flash-messages" style={{ marginBottom: '20px' }}>
        {flashMessage && (
          <div className={`flash ${flashMessage.type}`}>
            {flashMessage.text}
          </div>
        )}
      </div>

      <div className="admin-section">
        <div className="form-group" style={{ marginBottom: '20px', maxWidth: '400px' }}>
          <label htmlFor="staff-search" className="form-label">Search Staff</label>
          <input
            type="text"
            id="staff-search"
            className="form-control"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>

        {error && !isLoading && <p style={{ color: 'red' }}>{error}</p>}

        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>&nbsp;</th>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Age</th>
              <th style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody id="staff-table-body">
            {isLoading ? (
              <tr id="initial-loading-row">
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px', color: '#aaa' }}>Loading staff members...</td>
              </tr>
            ) : staffList.length > 0 ? (
              staffList.map((staff) => (
                <tr key={staff.id} className="staff-row" data-staff-id={staff.id}>
                  <td>
                    <img
                      src={getImageUrl(staff.profile_image)}
                      alt="Avatar"
                      className="avatar-small"
                      onError={(e) => { e.target.onerror = null; e.target.src='/static/img/avatar_picture_profile_user_icon.png'}}
                    />
                  </td>
                  <td>{staff.full_name || 'N/A'}</td>
                  <td>{staff.email || 'N/A'}</td>
                  <td>{staff.phone_number || 'N/A'}</td>
                  <td>{staff.age || 'N/A'}</td>
                  <td>
                  {/* Use React Router Link */}
                    <Link to={`/staff/${staff.id}`} className="cta-outline-small">View</Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr id="no-staff-row">
                <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                  {searchTerm ? 'No staff members found matching your search.' : 'No staff members found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <AddStaffModal
        isOpen={isModalOpen}
        onClose={closeAddStaffModal}
        onStaffAdded={handleStaffAdded}
      />
    </div>
  );
}

export default Staff;