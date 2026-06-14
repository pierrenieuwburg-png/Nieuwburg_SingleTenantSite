import React, { useState, useEffect } from 'react';
import { BarLoader } from 'react-spinners';
import { useDebounce } from '../hooks/useDebounce'; // Importing the hook

function AddManualBookingModal({ isOpen, onClose, onBooked, preselectedDate }) {
  const [staffList, setStaffList] = useState([]);
  const [serviceList, setServiceList] = useState([]);
  const [clientSuggestions, setClientSuggestions] = useState([]);
  const [formData, setFormData] = useState({
    full_name: '', email: '', phone_number: '', address: '',
    service_item_id: '', service_price: '', service_frequency: 'Once-off',
    staff_id: '', scheduled_date: '', scheduled_time: '09:00',
  });
  const [clientSearch, setClientSearch] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [saveNewClient, setSaveNewClient] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const debouncedClientSearch = useDebounce(clientSearch, 300);

  // Fetch initial data
  useEffect(() => {
    if (isOpen) {
      setFormData({
        full_name: '', email: '', phone_number: '', address: '',
        service_item_id: '', service_price: '', service_frequency: 'Once-off',
        staff_id: '',
        scheduled_date: preselectedDate || '',
        scheduled_time: '09:00',
      });
      setClientSearch('');
      setSelectedClient(null);
      setSaveNewClient(false);
      setError(null);
      setIsLoading(true);

      const fetchInitialData = async () => {
        try {
          const [staffRes, servicesRes] = await Promise.all([
            fetch('/api/admin/staff/all'),
            fetch('/api/admin/services/all_items')
          ]);
          if (!staffRes.ok) throw new Error('Failed to fetch staff');
          if (!servicesRes.ok) throw new Error('Failed to fetch services');
          const staffData = await staffRes.json();
          const servicesData = await servicesRes.json();
          setStaffList(staffData);
          setServiceList(servicesData);
        } catch (err) {
          setError(err.message);
        } finally {
          setIsLoading(false);
        }
      };
      fetchInitialData();
    }
  }, [isOpen, preselectedDate]);

  // Fetch client suggestions
  useEffect(() => {
    if (debouncedClientSearch && !selectedClient) {
      const fetchClients = async () => {
        try {
          const response = await fetch(`/api/admin/clients/search?q=${debouncedClientSearch}`);
          if (!response.ok) throw new Error('Failed to search clients');
          const data = await response.json();
          setClientSuggestions(data);
        } catch (err) {
          console.error(err);
        }
      };
      fetchClients();
    } else {
      setClientSuggestions([]);
    }
  }, [debouncedClientSearch, selectedClient]);

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleClientSearchChange = (e) => {
    setClientSearch(e.target.value);
    setSelectedClient(null);
    setFormData(prev => ({ ...prev, full_name: e.target.value }));
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setClientSearch(client.full_name);
    setClientSuggestions([]);
    setFormData(prev => ({
      ...prev,
      full_name: client.full_name,
      email: client.email || '',
      phone_number: client.phone_number || '',
      address: client.address || '',
    }));
  };

  // --- 1. IMPLEMENT CLICK-OUTSIDE-TO-CLOSE ---
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    const payload = {
      ...formData,
      save_new_client: saveNewClient,
      client_id: selectedClient ? selectedClient.id : null
    };
    try {
      const response = await fetch('/api/admin/jobs/manual_add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || 'Failed to create job.');
      }
      onBooked(data.message);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      className={`react-modal-overlay simple-modal ${isOpen ? 'modal-open' : ''}`}
      onClick={handleBackdropClick}
    >
      <div className="modal-content auth-modal-content" style={{ maxWidth: '700px' }}>
        <button
          type="button"
          className="modal-close" // This class is styled in Step 3
          aria-label="Close form"
          onClick={onClose}
          disabled={isSubmitting}
        >
          &times;
        </button>
        <h2 className="auth-title">Add Manual Booking</h2>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '20rem' }}>
            <BarLoader color="#4A90E2" width="50%" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form-modal active" style={{ paddingTop: '15px' }}>
            {error && (
              <div className="flash error" style={{ marginTop: 0, marginBottom: '15px' }}>
                {error}
              </div>
            )}

            <h3 className="form-section-header">Client Details</h3>
            
            <div className="form-group" style={{ position: 'relative' }}>
              <label htmlFor="client_search" className="form-label">Client Name (Type to search or add new)</label>
              <input
                type="text"
                id="client_search"
                name="full_name"
                className="form-control"
                value={clientSearch}
                onChange={handleClientSearchChange}
                required
                autoComplete="off"
              />
              {clientSuggestions.length > 0 && (
                <ul className="client-suggestions-list">
                  {clientSuggestions.map(client => (
                    <li
                      key={client.id}
                      onClick={() => handleSelectClient(client)}
                    >
                      {client.full_name} ({client.email})
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!selectedClient && (
              <>
                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="email" className="form-label">Email</label>
                    <input type="email" id="email" name="email" className="form-control" value={formData.email} onChange={handleFormChange} required />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label htmlFor="phone_number" className="form-label">Phone</label>
                    <input type="tel" id="phone_number" name="phone_number" className="form-control" value={formData.phone_number} onChange={handleFormChange} />
                  </div>
                </div>
                <div className="form-group">
                  <label htmlFor="address" className="form-label">Address</label>
                  <textarea id="address" name="address" className="form-control" value={formData.address} onChange={handleFormChange} rows="2"></textarea>
                </div>
                <div className="form-group-checkbox">
                  <input
                    type="checkbox"
                    id="saveNewClient"
                    name="saveNewClient"
                    checked={saveNewClient}
                    onChange={(e) => setSaveNewClient(e.target.checked)}
                  />
                  <label htmlFor="saveNewClient">Save as new client</label>
                </div>
              </>
            )}

            <h3 className="form-section-header">Booking Details</h3>

            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label htmlFor="service_item_id" className="form-label">Service</label>
                <select id="service_item_id" name="service_item_id" className="form-control" value={formData.service_item_id} onChange={handleFormChange} required>
                  <option value="" disabled>Select a service...</option>
                  {serviceList.map(service => (
                    <option key={service.id} value={service.id}>{service.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="service_price" className="form-label">Price (R)</label>
                <input type="number" id="service_price" name="service_price" className="form-control" value={formData.service_price} onChange={handleFormChange} required min="0" step="0.01" />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="service_frequency" className="form-label">Frequency</label>
              <select id="service_frequency" name="service_frequency" className="form-control" value={formData.service_frequency} onChange={handleFormChange} required>
                <option value="Once-off">Once-off</option>
                <option value="Weekly">Weekly</option>
                <option value="Bi-weekly">Bi-weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="staff_id" className="form-label">Assign Staff</label>
              <select id="staff_id" name="staff_id" className="form-control" value={formData.staff_id} onChange={handleFormChange} required>
                <option value="" disabled>Select a staff member...</option>
                {staffList.map(staff => (
                  <option key={staff.id} value={staff.id}>{staff.full_name}</option>
                ))}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="scheduled_date" className="form-label">Date</label>
                <input type="date" id="scheduled_date" name="scheduled_date" className="form-control" value={formData.scheduled_date} onChange={handleFormChange} required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label htmlFor="scheduled_time" className="form-label">Time</label>
                <input type="time" id="scheduled_time" name="scheduled_time" className="form-control" value={formData.scheduled_time} onChange={handleFormChange} required />
              </div>
            </div>

            {/* --- 3. FOOTER WITH NO CANCEL BUTTON --- */}
            <div className="modal-footer-custom">
              <button
                type="submit"
                className="cta"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Saving...' : 'Create Job'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default AddManualBookingModal;