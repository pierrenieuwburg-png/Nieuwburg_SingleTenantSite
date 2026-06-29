import React, { useState, useEffect } from 'react';
import { BarLoader } from 'react-spinners';

// Simple confirmation dialog
const confirmDelete = () => window.confirm("Are you sure you want to delete this booking?");

function DayBookingsModal({ isOpen, onClose, selectedDate, onBookingDeleted, onEditBooking }) {
  const [bookings, setBookings] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch data only when modal is open and a date is selected
    if (isOpen && selectedDate) {
      setIsLoading(true);
      setError(null);
      setBookings([]); 

      const fetchBookingsForDate = async () => {
        try {
          const response = await fetch(`/api/admin/jobs/by_date/${selectedDate}`);
          if (!response.ok) {
            const errData = await response.json();
            throw new Error(errData.message || `Failed to fetch bookings (Status: ${response.status})`);
          }
          const data = await response.json();
          setBookings(data);
        } catch (err) {
          console.error("Error fetching bookings for date:", err); // Log error
          setError(err.message);
        } finally {
          setIsLoading(false);
        }
      };

      fetchBookingsForDate();
    }
  }, [isOpen, selectedDate]); // Dependency array ensures refetch if date changes while open

  const handleDelete = async (jobId) => {
    if (!confirmDelete()) {
      return; 
    }

    // Indicate deletion is in progress (optional)
    // You could add another state, e.g., setIsDeleting(jobId)

    try {
      const response = await fetch(`/api/admin/jobs/${jobId}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.message || `Failed to delete booking (Status: ${response.status})`);
      }
      // Notify parent (Bookings.jsx)
      onBookingDeleted(jobId, selectedDate); 
      // Update local state to remove the item immediately from the list
      setBookings(prevBookings => prevBookings.filter(b => b.id !== jobId));
      // setError(null); // Clear previous errors on success
    } catch (err) {
       console.error("Error deleting booking:", err); // Log error
       setError(err.message); // Show error in the modal
    } finally {
        // Reset deletion indicator if used
        // setIsDeleting(null);
    }
  };

  // Click handler for the main booking item (Phase 2)
  const handleEditClick = (jobId) => {
      if (onEditBooking) {
          onEditBooking(jobId); // Call the function passed from Bookings.jsx
      }
  };

  // Format date nicely for the title
  const formattedDate = selectedDate
    ? new Date(selectedDate + 'T00:00:00Z').toLocaleDateString('en-ZA', { // Add Z for UTC interpretation
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
      })
    : 'N/A';

  // Use the isolated CSS classes for React modals
  return (
    <div 
      className={`react-modal-overlay simple-modal ${isOpen ? 'modal-open' : ''}`} 
      onClick={onClose} // Click outside to close
    >
      {/* Stop propagation prevents closing when clicking inside modal content */}
      <div className="modal-content auth-modal-content" style={{ maxWidth: '650px' }} onClick={e => e.stopPropagation()}> 
        <button type="button" className="modal-close" aria-label="Close modal" onClick={onClose}>&times;</button>
        <h2 className="auth-title">Bookings for {formattedDate}</h2>

        {isLoading && (
           <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '10rem' }}>
              <BarLoader color="#4A90E2" width="50%" />
           </div>
        )}
        {/* Display fetch/delete errors */}
        {error && <div className="flash error mb-4" style={{marginTop: '1rem'}}>{error}</div>} 

        {!isLoading && !error && (
          <div className="day-bookings-list mt-4">
            {bookings.length > 0 ? (
              <ul style={{listStyle: 'none', padding: 0, margin: 0}}>
                {bookings.map(job => (
                  <li key={job.id} className="day-booking-item group"> {/* Added group class */}
                    {/* Make the main div clickable for editing */}
                    <div className="booking-info" onClick={() => handleEditClick(job.id)}>
                      <span className="booking-time">{job.start_time}</span> - {job.client_name} ({job.service_name})
                      <div className="booking-details">Staff: {job.assigned_staff} | Status: {job.status}</div>
                    </div>
                    <button
                      type="button"
                      className="delete-button group-hover:opacity-100" // Use group-hover
                      title="Delete Booking"
                      onClick={(e) => {
                          e.stopPropagation(); // Prevent edit click when deleting
                          handleDelete(job.id);
                      }}
                    >
                      🗑️ 
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{textAlign: 'center', color: 'var(--text-light)', padding: '1rem 0'}}>
                  No bookings scheduled for this day.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default DayBookingsModal;