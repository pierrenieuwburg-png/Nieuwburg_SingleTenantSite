import React, { useState, useEffect } from 'react';
import { BarLoader } from 'react-spinners';

// Re-usable Input Field component
const InputField = ({ label, id, name, type = 'text', value, onChange, required = false, ...props }) => (
  <div className="form-group">
    <label htmlFor={id}>{label}</label>
    <input
      type={type}
      id={id}
      name={name}
      value={value}
      onChange={onChange}
      className="form-control"
      required={required}
      {...props}
    />
  </div>
);

// Re-usable TextArea Field component
const TextAreaField = ({ label, id, name, value, onChange, required = false, rows = 3, ...props }) => (
    <div className="form-group">
        <label htmlFor={id}>{label}</label>
        <textarea
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            className="form-control"
            required={required}
            rows={rows}
            {...props}
        />
    </div>
);


function AddStaffModal({ isOpen, onClose, onStaffAdded }) {
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone_number: '',
    address: '',
    id_number: '',
    send_activation_email: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [csrfToken, setCsrfToken] = useState('');

  // Combined useEffect to manage modal state
  useEffect(() => {
    if (isOpen) {
      const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      if (token) {
        setCsrfToken(token);
      } else {
        console.error("CSRF token not found in meta tag!");
        setError("Configuration error: CSRF token missing.");
      }
      setError(null);
    } else {
      setFormData({
        full_name: '',
        email: '',
        phone_number: '',
        address: '',
        id_number: '',
        send_activation_email: true
      });
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prevData) => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
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

    const dataToSend = {
      ...formData,
      csrf_token: csrfToken
    };

    try {
      const response = await fetch('/api/admin/staff', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken,
        },
        body: JSON.stringify(dataToSend),
      });

      const result = await response.json();

      if (response.ok) {
        onStaffAdded(result.message || 'Staff member added successfully!');
        onClose();
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
    return null;
  }

  return (
    <div id="add-staff-modal" className="modal-overlay simple-modal" style={{ display: 'flex' }}>
      <div className="modal-content auth-modal-content" style={{ maxWidth: '500px' }}>
        <button
          id="close-add-staff-modal"
          className="modal-close"
          aria-label="Close form"
          onClick={onClose}
          disabled={isSubmitting}
        >
          &times;
        </button>
        <h2 className="auth-title">Add New Staff Member</h2>

        {error && (
          <div id="add-staff-error-message" className="flash error" style={{ marginTop: 0, marginBottom: '15px' }}>
            {error}
          </div>
        )}

        <form id="add-staff-form" className="auth-form-modal active" style={{ paddingTop: '15px', gap: '15px' }} onSubmit={handleSubmit}>
          
          <InputField
            label="Full Name"
            id="add-staff-full_name" name="full_name" type="text"
            value={formData.full_name}
            onChange={handleChange}
            required
          />
          <InputField
            label="Email"
            id="add-staff-email" name="email" type="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          <InputField
            label="Phone Number"
            id="add-staff-phone_number" name="phone_number" type="tel"
            value={formData.phone_number}
            onChange={handleChange}
          />
          <InputField
            label="ID Number (Optional)"
            id="add-staff-id_number" name="id_number" type="text"
            value={formData.id_number}
            onChange={handleChange}
          />
          <TextAreaField
            label="Address (Optional)"
            id="add-staff-address" name="address"
            value={formData.address}
            onChange={handleChange}
            rows={3}
          />
          
          {/* === THIS IS THE FIX === */}
          {/* We wrap the checkbox in a form-group and use flexbox for alignment */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="checkbox"
                id="add-staff-send_activation_email"
                name="send_activation_email"
                checked={formData.send_activation_email}
                onChange={handleChange}
                style={{ width: 'auto', height: 'auto', margin: 0 }} // Reset default input styles
              />
              <label 
                htmlFor="add-staff-send_activation_email" 
                style={{ marginBottom: 0, fontWeight: 'normal', fontSize: '0.9rem', cursor: 'pointer' }}
              >
                Send account activation email
              </label>
            </div>
          </div>
          {/* === END OF FIX === */}

          <button type="submit" className="cta" disabled={isSubmitting} style={{marginTop: '10px'}}>
            {isSubmitting ? 'Saving...' : 'Save Staff'}
          </button>

        </form>
      </div>
    </div>
  );
}

export default AddStaffModal;