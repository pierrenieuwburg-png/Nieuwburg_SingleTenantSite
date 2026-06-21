import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

// Simple inline confirmation modal component
// Simple class-based confirmation modal component
const ConfirmationModal = ({ isOpen, onClose, onConfirm, message }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay simple-modal">
      <div className="modal-content">
        <h3>Confirm Deletion</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button onClick={onClose} className="cta-outline">Cancel</button>
          <button onClick={onConfirm} className="cta-danger">Confirm Delete</button>
        </div>
      </div>
    </div>
  );
};


function ClientDetail() {
  const { clientId } = useParams();
  const navigate = useNavigate(); // Hook for navigation
  const [client, setClient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false); // State for delete operation
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false); // State for confirmation modal
  const [deleteError, setDeleteError] = useState(null); // Specific error for delete
  const [csrfToken, setCsrfToken] = useState('');

  // Get CSRF token
  useEffect(() => {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
    setCsrfToken(token || '');
  }, []);


  // Fetch client details (keep as is)
  useEffect(() => {
    const fetchClientDetails = async () => {
      // ... (existing fetch logic remains the same) ...
            setIsLoading(true);
      setError(null);
      setDeleteError(null); // Clear delete error on load
      try {
        const response = await fetch(`/api/admin/clients/${clientId}`); // Use clientId in URL
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('Client not found.');
          }
           if (response.status === 403) {
            throw new Error('Permission denied fetching client details.');
           }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setClient(data);
      } catch (err) {
        console.error('Error fetching client details:', err);
        setError(`Error loading client data: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchClientDetails();
  }, [clientId]);

  // --- Delete Logic ---
  const openDeleteModal = () => {
    setDeleteError(null); // Clear previous delete errors
    setIsDeleteModalOpen(true);
  };
  const closeDeleteModal = () => setIsDeleteModalOpen(false);

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    if (!csrfToken) {
        setDeleteError("Cannot delete: CSRF token missing.");
        setIsDeleting(false);
        closeDeleteModal(); 
        return;
    }

    try {
      // FIX: Add the /api/ prefix to ensure it hits the API blueprint
      const response = await fetch(`/api/admin/clients/delete/${clientId}`, { 
        method: 'POST', 
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
      });

      const result = await response.json();

      if (response.ok) {
        navigate('/clients', { state: { flashMessage: { type: 'success', text: result.message || 'Client deleted successfully.' } } });
      } else {
        throw new Error(result.message || 'Failed to delete client.');
      }
    } catch (err) {
      console.error('Error deleting client:', err);
      setDeleteError(`Deletion failed: ${err.message}`);
      setIsDeleting(false); 
      closeDeleteModal(); 
    }
  };

  // Helper to format currency (keep as is)
  const formatCurrency = (value) => {
    // ... (existing format logic) ...
        if (value === null || value === undefined) return 'N/A';
        return `R${parseFloat(value).toFixed(2)}`;
  };

  if (isLoading) {
    return <div className="loading-indicator">Loading client details...</div>;
  }

  // Display general fetch error first
  if (error && !client) { // Show fetch error only if client data failed to load
     return (
        <div>
            <Link to="/clients" className="cta-outline" style={{ marginBottom: '20px', display: 'inline-block' }}>
                ← Back to Client List
            </Link>
            <div className="flash error">{error}</div>
        </div>
     );
  }

  // Handle case where client is somehow null after loading without error (shouldn't happen often)
  if (!client) {
    return (
         <div>
            <Link to="/clients" className="cta-outline" style={{ marginBottom: '20px', display: 'inline-block' }}>
                ← Back to Client List
            </Link>
            <p>Client data not available.</p>
         </div>
    );
  }

  // Render client details
  return (
    <div>
      <div className="admin-header">
        <h1>{client.profile?.full_name || client.email}</h1>
        <div>
          <Link to="/clients" className="cta-outline">← Back to Client List</Link>
          <Link to={`/client/edit/${clientId}`} className="cta" style={{ marginLeft: '10px' }}>Edit Details</Link>
        </div>
      </div>

      {/* Display delete error if it occurred */}
      {deleteError && (
        <div className="flash error" style={{ marginBottom: '20px' }}>
          {deleteError}
        </div>
      )}

      {/* Client Details Section (keep as is) */}
      <div className="admin-section">
        <div style={{ marginBottom: '20px', padding: '12px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px' }}>
            <span style={{ display: 'block', fontSize: '12px', color: '#92400e', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>
                <i className="fa-solid fa-arrows-rotate" style={{marginRight: '6px'}}></i> Next Rotational Focus
            </span>
            <span style={{ fontSize: '15px', color: '#b45309', fontWeight: '500' }}>
                {client.profile?.next_suggested_rotational_task || "No specific focus requested."}
            </span>
        </div>
        {/* ------------------------------------ */}
        <h2>Client Details</h2>
        
        <div className="profile-details">
          {/* ... existing detail items ... */}
             <div className="detail-item"><label>Full Name</label><p>{client.profile?.full_name || 'N/A'}</p></div>
              <div className="detail-item"><label>Email</label><p>{client.email}</p></div>
              <div className="detail-item"><label>Phone Number</label><p>{client.profile?.phone_number || 'N/A'}</p></div>
              <div className="detail-item"><label>Physical Address</label><p>{client.profile?.address || 'N/A'}</p></div>
              <hr />
              <div className="detail-item"><label>Service Frequency</label><p>{client.profile?.service_frequency || 'N/A'}</p></div>
              <div className="detail-item"><label>Service Fee</label><p>{formatCurrency(client.profile?.service_fee)}</p></div>
        </div>
      </div>

      {/* Notes Section (keep as is) */}
      <div className="admin-section">
          {/* ... existing notes ... */}
             <h2>Notes</h2>
            <div className="notes-display">
              <p style={{ whiteSpace: 'pre-wrap' }}>
                {client.profile?.notes || 'No notes have been added for this client.'}
              </p>
            </div>
      </div>

      {/* Booking History Section (keep as is) */}
      <div className="admin-section">
          {/* ... existing booking history ... */}
            <h2>Booking History (Last 10)</h2>
            <div className="bookings-list"> {/* Consider using a table here too */}
              {client.booking_history && client.booking_history.length > 0 ? (
                client.booking_history.map(booking => (
                  <div className="booking-item" key={booking.id}> {/* Use class from style.css */}
                    <div className="booking-details">
                      <span className="booking-date">Requested on: {booking.request_date}</span>
                      <span className="booking-service">Service: {booking.primary_service}</span>
                      {/* Use className for status */}
                      <span className={`booking-status status-${booking.status?.toLowerCase() || 'unknown'}`}>
                        {booking.status}
                      </span>
                    </div>
                    <div className="booking-info">
                      <p><strong>Property:</strong> {booking.property_type}</p>
                      <p><strong>Frequency:</strong> {booking.service_frequency}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p>This client has no quote requests or booking history.</p>
              )}
            </div>
      </div>

      {/* Danger Zone: Enable Delete button */}
      <div className="admin-section">
        <h2 style={{ color: '#c82333' }}>Danger Zone</h2>
        <p>Permanently remove this client and all associated data from the system.</p>
        {/* Enable button and add onClick handler */}
        <button
          type="button"
          className="cta-danger"
          onClick={openDeleteModal}
          disabled={isDeleting} // Disable while delete is in progress
        >
          {isDeleting ? 'Deleting...' : 'Delete Client'}
        </button>
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        message={`DANGER: You are about to permanently delete ${client.profile?.full_name || client.email}. This action cannot be undone. Are you absolutely sure?`}
      />

    </div>
  );
}

export default ClientDetail;