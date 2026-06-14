import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

// Import the ConfirmationModal component (we'll reuse it)
// Assuming ConfirmationModal.jsx exists in ../components/
// If not, copy it from the ClientDetail implementation or create it.
// import ConfirmationModal from '../components/ConfirmationModal';

// Simple inline confirmation modal component (if not importing)
const ConfirmationModal = ({ isOpen, onClose, onConfirm, message, confirmText = "Confirm Delete", cancelText = "Cancel", title = "Confirm Action" }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay simple-modal" style={{ display: 'flex' }}>
      <div className="modal-content" style={{ maxWidth: '450px' }}>
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        <p>{message}</p>
        <div className="modal-actions">
          <button onClick={onClose} className="cta-outline">{cancelText}</button>
          <button onClick={onConfirm} className="cta-danger">{confirmText}</button>
        </div>
      </div>
    </div>
  );
};


function StaffDetail() {
  const { staffId } = useParams(); // Get ID from URL parameter
  const navigate = useNavigate();
  const [staffMember, setStaffMember] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionInProgress, setActionInProgress] = useState(false); // For delete/reset
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [actionError, setActionError] = useState(null); // Specific error for actions
  const [actionSuccess, setActionSuccess] = useState(null); // Success message for actions
  const [csrfToken, setCsrfToken] = useState('');

  // Get CSRF token
   useEffect(() => {
     const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
     setCsrfToken(token || '');
   }, []);

  // Fetch Staff Details
  useEffect(() => {
    const fetchStaffDetails = async () => {
      setIsLoading(true);
      setError(null);
      setActionError(null); // Clear action errors on load
      setActionSuccess(null); // Clear success messages on load
      try {
        const response = await fetch(`/api/admin/staff/${staffId}`);
        if (!response.ok) {
          if (response.status === 404) throw new Error('Staff member not found.');
          if (response.status === 403) throw new Error('Permission denied.');
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setStaffMember(data);
      } catch (err) {
        console.error('Error fetching staff details:', err);
        setError(`Error loading staff data: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStaffDetails();
  }, [staffId]); // Re-run if staffId changes

    // --- Action Handlers ---
    const openDeleteModal = () => { setActionError(null); setActionSuccess(null); setIsDeleteModalOpen(true); };
    const closeDeleteModal = () => setIsDeleteModalOpen(false);

    const openResetModal = () => { setActionError(null); setActionSuccess(null); setIsResetModalOpen(true); };
    const closeResetModal = () => setIsResetModalOpen(false);

    const handleConfirmDelete = async () => {
        setActionInProgress(true);
        setActionError(null);
        closeDeleteModal(); // Close modal immediately

        if (!csrfToken) {
            setActionError("Cannot delete: CSRF token missing.");
            setActionInProgress(false);
            return;
        }

        try {
            const response = await fetch(`/admin/staff/delete/${staffId}`, { // Use Flask POST route
                method: 'POST',
                headers: { 'X-CSRFToken': csrfToken }
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Failed to delete staff member.');

            // Redirect to staff list on success, passing success message
            navigate('/staff', { state: { flashMessage: { type: 'success', text: result.message || 'Staff member deleted.' } } });

        } catch (err) {
            console.error('Error deleting staff:', err);
            setActionError(`Deletion failed: ${err.message}`);
            setActionInProgress(false);
        }
    };

    const handleConfirmReset = async () => {
        setActionInProgress(true);
        setActionError(null);
        setActionSuccess(null);
        closeResetModal();

         if (!csrfToken) {
            setActionError("Cannot reset password: CSRF token missing.");
            setActionInProgress(false);
            return;
        }

        try {
            const response = await fetch(`/admin/staff/reset-password/${staffId}`, { // Use Flask POST route
                method: 'POST',
                headers: { 'X-CSRFToken': csrfToken }
            });
             const result = await response.json();
             if (!response.ok) throw new Error(result.message || 'Failed to initiate password reset.');

             setActionSuccess(result.message || 'Password reset initiated.'); // Show success message

        } catch(err) {
             console.error('Error resetting password:', err);
             setActionError(`Password reset failed: ${err.message}`);
        } finally {
             setActionInProgress(false);
        }

    };
    // --- End Action Handlers ---


  // Function to get image URL
  const getImageUrl = (imageFilename) => {
    const defaultAvatar = '/static/img/avatar_picture_profile_user_icon.png';
    if (!imageFilename || imageFilename === 'avatar_picture_profile_user_icon.png') {
        return defaultAvatar;
    }
    return `/static/uploads/${imageFilename}`;
  };

   // Function to generate link for viewing uploaded documents
  const getDocumentLink = (filename) => {
    return `/static/uploads/${filename}`;
  };


  if (isLoading) {
    return <div className="loading-indicator">Loading staff details...</div>;
  }

  if (error) {
     return (
         <div>
            <Link to="/staff" className="cta-outline" style={{ marginBottom: '20px', display: 'inline-block' }}>
                ← Back to Staff List
            </Link>
            <div className="flash error">{error}</div>
        </div>
     );
  }

  if (!staffMember) {
    return <p>Staff member data not available.</p>;
  }

  const profile = staffMember.profile || {}; // Handle potentially missing profile

  return (
    <div>
      <div className="admin-header">
        <h1>{profile.full_name || staffMember.email}</h1>
        <div>
          <Link to="/staff" className="cta-outline">← Back to Staff List</Link>
          {/* Link to future Edit Staff component */}
          <Link to={`/staff/edit/${staffMember.id}`} className="cta" style={{ marginLeft: '10px' }}>Edit Details</Link>
        </div>
      </div>

      {/* Display action success/error messages */}
       {actionError && (
            <div className="flash error" style={{ marginBottom: '20px' }}>
            {actionError}
            </div>
        )}
        {actionSuccess && (
            <div className="flash success" style={{ marginBottom: '20px' }}>
            {actionSuccess}
            </div>
        )}


      <div className="admin-section">
        <h2>Personal Details</h2>
        <div className="profile-details">
          {/* Display details similar to admin_view_staff.html */}
          <div className="detail-item"><label>Full Name</label><p>{profile.full_name || 'N/A'}</p></div>
          <div className="detail-item"><label>Email</label><p>{staffMember.email || 'N/A'}</p></div>
          <div className="detail-item"><label>Phone Number</label><p>{profile.phone_number || 'N/A'}</p></div>
          <div className="detail-item"><label>Physical Address</label><p>{profile.address || 'N/A'}</p></div>
          <hr />
          <div className="detail-item"><label>ID Number</label><p>{profile.id_number || 'N/A'}</p></div>
          <div className="detail-item"><label>Date of Birth</label><p>{profile.date_of_birth || 'N/A'}</p></div>
          <div className="detail-item"><label>Age</label><p>{profile.age ?? 'N/A'}</p></div>
        </div>
      </div>

      <div className="admin-section">
        <h2>Strengths & Skills</h2>
        <div className="notes-display">
          <p style={{ whiteSpace: 'pre-wrap' }}>
            {profile.strengths || 'No strengths have been noted.'}
          </p>
        </div>
      </div>

      <div className="admin-section">
        <h2>Vetting Status</h2>
        {/* Using vetting-status-list class */}
        <div className="vetting-status-list">
          <div className="vetting-item">
            <span className="status-icon">{profile.has_id_copy ? '✅' : '❌'}</span>
            <span>Copy of ID on file</span>
          </div>
          <div className="vetting-item">
            <span className="status-icon">{profile.has_drivers_license ? '✅' : '❌'}</span>
            <span>Driver's license on file</span>
          </div>
          <div className="vetting-item">
            <span className="status-icon">{profile.has_criminal_check ? '✅' : '❌'}</span>
            <span>Criminal record check complete</span>
          </div>
        </div>
      </div>

      <div className="admin-section">
        <h2>Uploaded Documents</h2>
        <div className="documents-list">
          {profile.documents && profile.documents.length > 0 ? (
            <ul>
              {profile.documents.map((doc, index) => (
                <li key={index}>
                  <a href={getDocumentLink(doc)} target="_blank" rel="noopener noreferrer">
                     {/* Attempt to show a cleaner filename */}
                     {doc.includes('_') ? doc.split('_').slice(1).join('_') || doc : doc}
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p>No documents have been uploaded for this staff member.</p>
          )}
        </div>
      </div>

      <div className="admin-section">
        <h2>Notes</h2>
        <div className="notes-display">
          <p style={{ whiteSpace: 'pre-wrap' }}>
            {profile.notes || 'No notes have been added for this staff member.'}
          </p>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="admin-section">
        <h2 style={{ color: '#c82333' }}>Danger Zone</h2>
        {/* Password Reset */}
         <div style={{ marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #eee' }}>
             <p>Generate a new activation link and require the staff member to set a new password on their next login.</p>
             <button type="button" className="cta-outline" onClick={openResetModal} disabled={actionInProgress}>
                {actionInProgress ? 'Processing...' : 'Reset Password'}
             </button>
         </div>
         {/* Delete Staff */}
         <div>
            <p>Permanently remove this staff member and all associated data from the system.</p>
            <button type="button" className="cta-danger" onClick={openDeleteModal} disabled={actionInProgress}>
                {actionInProgress ? 'Processing...' : 'Delete Staff Member'}
            </button>
         </div>
      </div>

      {/* Confirmation Modals */}
      <ConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        onConfirm={handleConfirmDelete}
        title="Confirm Deletion"
        message={`DANGER: You are about to permanently delete ${profile.full_name || staffMember.email}. This action cannot be undone. Are you absolutely sure?`}
        confirmText="Confirm Delete"
      />
       <ConfirmationModal
        isOpen={isResetModalOpen}
        onClose={closeResetModal}
        onConfirm={handleConfirmReset}
        title="Confirm Password Reset"
        message={`Are you sure you want to reset the password for ${profile.full_name || staffMember.email}? They will be sent an email (if available) to set a new password.`}
        confirmText="Reset Password"
        // Use a different button style for reset if needed, e.g., standard CTA
         confirmButtonClass="cta" // Optional: Reuse standard cta style
      />

    </div>
  );
}

export default StaffDetail;