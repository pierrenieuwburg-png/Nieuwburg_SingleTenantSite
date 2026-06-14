import React, { useState, useEffect } from 'react';

// Reusable Input Field component
const InputField = ({ label, id, name, type = 'text', value, onChange, required = false, ...props }) => (
  <div className="form-group">
    <label htmlFor={id}>{label}</label>
    <input
      type={type}
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      className="form-control" // Using the class from your file
      required={required}
      {...props}
    />
  </div>
);

// Reusable TextArea Field component
const TextAreaField = ({ label, id, name, value, onChange, required = false, rows = 3, ...props }) => (
    <div className="form-group">
        <label htmlFor={id}>{label}</label>
        <textarea
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            className="form-control" // Using the class from your file
            required={required}
            rows={rows}
            {...props}
        />
    </div>
);


function AddClientModal({ isOpen, onClose, onClientAdded }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    address: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [csrfToken, setCsrfToken] = useState('');

  // We will combine the two useEffects into one for robustness
  useEffect(() => {
    if (isOpen) {
      // --- MODAL IS OPENING ---
      const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      if (token) {
        setCsrfToken(token);
      } else {
        console.error("CSRF token not found in meta tag!");
        setError("Configuration error: CSRF token missing.");
      }
      setError(null); // Clear previous errors
    } else {
      // --- MODAL IS CLOSING ---
      setFormData({
        full_name: '',
        email: '',
        phone_number: '',
        address: '',
      });
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    if (!csrfToken) {
        setError("Cannot submit form: CSRF token is missing.");
        setIsSubmitting(false);
        return;
    }

    // === THIS IS THE FIX ===
    // We must add the csrf_token to the JSON body
    // for the Flask-WTF form to validate.
    const dataToSend = {
        ...formData,
        csrf_token: csrfToken 
    };
    // === END OF FIX ===

    try {
      const response = await fetch('/api/admin/clients', { // API endpoint from api.py
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken, // It's good to keep this header too
        },
        body: JSON.stringify(dataToSend), // <-- Send the data *with* the token
      });

      const result = await response.json();

      if (response.ok) {
        onClientAdded(result.message || 'Client added successfully!'); // Call parent callback
        onClose(); // Close the modal
      } else {
        setError(result.message || 'An error occurred.');
      }
    } catch (err) {
      console.error('Error submitting form:', err);
      setError('A network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null; // Don't render anything if the modal is closed
  }

  // Use class names similar to the original modal for styling
  return (
    <div id="add-client-modal" className="modal-overlay simple-modal" style={{ display: 'flex' }}>
      <div className="modal-content auth-modal-content" style={{ maxWidth: '500px' }}>
        <button
          id="close-add-client-modal"
          className="modal-close"
          aria-label="Close form"
          onClick={onClose}
          disabled={isSubmitting}
        >
          &times;
        </button>
        <h2 className="auth-title">Add New Client</h2>

        {error && (
          <div id="add-client-error-message" className="flash error" style={{ marginTop: 0, marginBottom: '15px' }}>
            {error}
          </div>
        )}

        <form id="add-client-form" className="auth-form-modal active" style={{ paddingTop: '15px', gap: '15px' }} onSubmit={handleSubmit}>
          {/* We now add the token to the body, so no hidden input is needed */}

          <InputField
            label="Full Name"
            id="add-client-full_name"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            required
          />
          <InputField
            label="Email"
            id="add-client-email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <InputField
            label="Phone Number"
            id="add-client-phone_number"
            name="phone_number"
            type="tel"
            value={formData.phone_number}
            onChange={handleChange}
          />
          <TextAreaField
            label="Address"
            id="add-client-address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            rows={3}
          />

          {/* Moved buttons to a modal-footer for consistency */}
        </form>
        
        <div className="modal-footer" style={{marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-color)'}}>
            <button type="button" className="cta-outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button 
              type="submit" 
              className="cta" 
              form="add-client-form" 
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Client'}
            </button>
        </div>
        
      </div>
    </div>
  );
}

export default AddClientModal;