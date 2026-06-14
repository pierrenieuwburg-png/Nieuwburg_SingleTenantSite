import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import AddClientModal from '../components/AddClientModal';

function Clients() {
  const [clients, setClients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const location = useLocation(); // Hook to get navigation state
  const [flashMessage, setFlashMessage] = useState(location.state?.flashMessage || null);

  // Clear flash message from location state after reading it
  useEffect(() => {
    if (location.state?.flashMessage) {
        // Use navigate with replace: true if you want to remove it from history
        // Or simply clear the state locally if you don't mind it being in history
        window.history.replaceState({}, document.title) // Clears state from history entry
    }
  }, [location.state]);


  // Effect to clear flash message after timeout (keep as is)
  useEffect(() => {
    if (flashMessage) {
      const timer = setTimeout(() => setFlashMessage(null), 4000);
      return () => clearTimeout(timer); // Cleanup timer
    }
  }, [flashMessage]); // Run when flashMessage changes


  // ... (keep debounce, fetchClients, debouncedFetchClients, useEffect for search, handleSearchChange) ...
    // Debounce function (keep as is)
  const debounce = (func, delay) => {
    // ... (debounce implementation)
        let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  };

  // Function to fetch clients (keep as is, maybe reset error on success)
  const fetchClients = async (query = '') => {
    setIsLoading(true);
    // setError(null); // Reset error only if needed, flash handles success
    try {
      const response = await fetch(`/api/admin/clients/search?q=${encodeURIComponent(query)}`); // API Endpoint
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Permission denied fetching clients.');
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setClients(data);
      setError(null); // Clear error on successful fetch
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError(`Error loading clients: ${err.message}`);
      setClients([]);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced fetchClients (keep as is)
  const debouncedFetchClients = useCallback(debounce(fetchClients, 300), []);

  // Effect for initial load and search (keep as is)
  useEffect(() => {
    if (searchTerm === '' && clients.length === 0) { // Fetch only if clients aren't loaded yet
       fetchClients();
    } else {
       debouncedFetchClients(searchTerm);
    }
  }, [searchTerm, debouncedFetchClients, clients.length]);

  const handleSearchChange = (event) => {
    setSearchTerm(event.target.value);
  };

  // --- Modal Control Functions ---
  const openAddClientModal = () => setIsModalOpen(true);
  const closeAddClientModal = () => setIsModalOpen(false);

  // --- Callback for when a client is successfully added ---
  const handleClientAdded = (message) => {
    setFlashMessage({ type: 'success', text: message }); // Show success message
    fetchClients(searchTerm); // Refresh the client list (respecting current search)
    // Clear the flash message after a few seconds (handled by useEffect now)
  };

  // ... (rest of the component, including the return statement, remains the same) ...
    return (
    <div>
      <div className="admin-header">
        <h1>Client Management</h1>
        {/* Update button to open modal */}
        <button type="button" className="cta" onClick={openAddClientModal} >
          Add New Client
        </button>
      </div>

      {/* Area to display flash messages */}
      <div id="client-flash-messages" style={{ marginBottom: '20px' }}>
        {flashMessage && (
          <div className={`flash ${flashMessage.type}`}>
            {flashMessage.text}
          </div>
        )}
      </div>

      <div className="admin-section">
        <div className="form-group" style={{ marginBottom: '20px', maxWidth: '400px' }}>
          <label htmlFor="client-search" className="form-label">Search Clients</label>
          <input
            type="text"
            id="client-search"
            className="form-control"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={handleSearchChange}
          />
        </div>

        {error && !isLoading && <p style={{ color: 'red' }}>{error}</p>} {/* Show fetch error only when not loading */}

        <table className="data-table">
          <thead>
            {/* ... table header ... */}
              <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Address</th>
              <th style={{ width: '120px' }}>Actions</th>
            </tr>
          </thead>
          <tbody id="client-table-body">
            {isLoading ? (
              <tr>
                <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>Loading clients...</td>
              </tr>
            ) : clients.length > 0 ? (
              clients.map((client) => (
                <tr key={client.id} className="client-row" data-client-id={client.id}>
                  {/* ... table data cells ... */}
                  <td className="client-name">{client.full_name || 'N/A'}</td>
                  <td className="client-email">{client.email}</td>
                  <td className="client-phone">{client.phone_number || 'N/A'}</td>
                  <td className="client-address" style={{ maxWidth: '300px', whiteSpace: 'normal' }}>
                    {client.address || 'N/A'}
                  </td>
                   <td>
                        <Link to={`/clients/${client.id}`} className="cta-outline-small">
                          View
                        </Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr /* ... existing no clients row ... */ id="no-clients-row">
                 <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                  {searchTerm ? 'No clients found matching your search.' : 'No clients found.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Render the Add Client Modal */}
      <AddClientModal
        isOpen={isModalOpen}
        onClose={closeAddClientModal}
        onClientAdded={handleClientAdded}
      />
    </div>
  );
}

export default Clients;