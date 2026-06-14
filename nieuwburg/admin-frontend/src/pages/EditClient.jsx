import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function EditClient() {
    const { clientId } = useParams();
    const navigate = useNavigate();
    
    // --- THIS IS THE FIX ---
    // Get CSRF token from the DOM, just like in EditStaff.jsx
    const [csrfToken, setCsrfToken] = useState('');
    useEffect(() => {
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        setCsrfToken(token || '');
    }, []);
    // --- END OF FIX ---

    const [clientData, setClientData] = useState({
        full_name: '',
        email: '',
        phone_number: '',
        address: '',
        service_frequency: '',
        service_fee: '',
        notes: ''
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);

    // Fetch existing client data
    useEffect(() => {
        const fetchClientData = async () => {
            try {
                const response = await fetch(`/api/admin/clients/${clientId}`);
                if (!response.ok) {
                    throw new Error('Failed to fetch client data');
                }
                const data = await response.json();
                // Set form data from the client.profile object
                setClientData({
                    full_name: data.profile.full_name || '',
                    email: data.email || '', // Email is on the root object
                    phone_number: data.profile.phone_number || '',
                    address: data.profile.address || '',
                    service_frequency: data.profile.service_frequency || '',
                    service_fee: data.profile.service_fee || '',
                    notes: data.profile.notes || ''
                });
                setLoading(false);
            } catch (err) {
                setError(err.message);
                setLoading(false);
            }
        };

        fetchClientData();
    }, [clientId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setClientData(prevState => ({
            ...prevState,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);
        
        // Use the csrfToken from state
        if (!csrfToken) {
            setError('CSRF token not found. Please reload.');
            return;
        }

        // Prepare data for submission
        const submissionData = {
            full_name: clientData.full_name,
            phone_number: clientData.phone_number,
            address: clientData.address,
            service_frequency: clientData.service_frequency,
            service_fee: clientData.service_fee,
            notes: clientData.notes
        };

        try {
            const response = await fetch(`/api/admin/clients/${clientId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken // Use the token from state
                },
                body: JSON.stringify(submissionData)
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Update failed');
            }

            setSuccess('Client updated successfully!');
            setTimeout(() => navigate(`/clients/${clientId}`), 1500);

        } catch (err) {
            setError(`Update error: ${err.message}`);
        }
    };

    if (loading) return <div>Loading client details...</div>;
    if (error && !success) return <div className="error-message">{error}</div>;

    return (
        <div className="page-container">
            <h1>Edit Client: {clientData.full_name}</h1>
            <p>Client ID: {clientId}</p>
            <div className="admin-section">
            <form onSubmit={handleSubmit} className="edit-form">
                {success && <div className="success-message">{success}</div>}
                {error && <div className="error-message">{error}</div>}

                <div className="form-group">
                    <label htmlFor="full_name">Full Name</label>
                    <input
                        type="text"
                        id="full_name"
                        name="full_name"
                        value={clientData.full_name}
                        onChange={handleChange}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="email">Email (Cannot be changed)</label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        value={clientData.email}
                        readOnly
                        disabled
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="phone_number">Phone Number</label>
                    <input
                        type="tel"
                        id="phone_number"
                        name="phone_number"
                        value={clientData.phone_number}
                        onChange={handleChange}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="address">Address</label>
                    <textarea
                        id="address"
                        name="address"
                        rows="3"
                        value={clientData.address}
                        onChange={handleChange}
                    ></textarea>
                </div>

                <div className="form-group">
                    <label htmlFor="service_frequency">Service Frequency</label>
                    <input
                        type="text"
                        id="service_frequency"
                        name="service_frequency"
                        value={clientData.service_frequency}
                        onChange={handleChange}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="service_fee">Service Fee (ZAR)</label>
                    <input
                        type="number"
                        step="0.01"
                        id="service_fee"
                        name="service_fee"
                        value={clientData.service_fee}
                        onChange={handleChange}
                    />
                </div>

                <div className="form-group">
                    <label htmlFor="notes">Notes</label>
                    <textarea
                        id="notes"
                        name="notes"
                        rows="5"
                        value={clientData.notes}
                        onChange={handleChange}
                    ></textarea>
                </div>

                <div className="form-actions">
                    <button type="submit" className="cta">Save Changes</button>
                    <button type="button" className="button-secondary" onClick={() => navigate(`/client/${clientId}`)}>Cancel</button>
                </div>
            </form>
            </div>
        </div>
    );
}

export default EditClient;