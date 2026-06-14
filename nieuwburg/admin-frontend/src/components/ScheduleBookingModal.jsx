import React, { useState, useEffect } from 'react';
import { BarLoader } from 'react-spinners';

function ScheduleBookingModal({ isOpen, onClose, onSuccess, initialDate }) {
    const [csrfToken, setCsrfToken] = useState("");
    
    const [clients, setClients] = useState([]);
    const [services, setServices] = useState([]);
    const [staffList, setStaffList] = useState([]);
    
    const [isNewClient, setIsNewClient] = useState(false);
    
    const [formData, setFormData] = useState({
        client_id: "",
        full_name: "",
        email: "",
        phone_number: "",
        address: "",
        service_item_id: "",
        service_price: "",
        service_frequency: "Once-Off",
        staff_id: "",
        scheduled_date: "", 
        scheduled_time: "09:00"
    });
    
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // --- INLINE STYLES (The Fix) ---
    const overlayStyle = {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)', // Dark overlay
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999, // Force it on top
        backdropFilter: 'blur(2px)'
    };

    const contentStyle = {
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '600px',
        padding: '0', // Padding handled by children
        maxHeight: '90vh',
        overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column'
    };

    // --- Load Data & Set Initial Date ---
    useEffect(() => {
        if(!isOpen) return;
        
        const defaultDate = initialDate || new Date().toISOString().split('T')[0];
        setFormData(prev => ({ ...prev, scheduled_date: defaultDate }));

        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
        setCsrfToken(token || "");

        const loadData = async () => {
            setIsLoading(true);
            try {
                const [clientRes, staffRes, serviceRes] = await Promise.all([
                    fetch('/api/admin/clients/search'),
                    fetch('/api/admin/staff/all'),
                    fetch('/api/admin/services/all_items')
                ]);
                setClients(await clientRes.json());
                setStaffList(await staffRes.json());
                setServices(await serviceRes.json());
            } catch(e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [isOpen, initialDate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleServiceChange = (e) => {
        const serviceId = e.target.value;
        // const service = services.find(s => s.id.toString() === serviceId); 
        setFormData(prev => ({ ...prev, service_item_id: serviceId }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);

        const payload = { ...formData, save_new_client: isNewClient };

        try {
            const response = await fetch('/api/admin/jobs/manual_add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();
            if(!response.ok) throw new Error(result.message);
            onSuccess();
        } catch (err) {
            alert(err.message);
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    // --- RENDER WITH INLINE STYLES ---
    return (
        <div style={overlayStyle}> {/* Replaced className with style */}
            <div style={contentStyle}> {/* Replaced className with style */}
                
                {/* Header */}
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>Add Manual Booking</h2>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
                </div>
                
                {isLoading ? (
                    <div style={{ padding: '40px' }}><BarLoader color="#006ac6" width="100%"/></div>
                ) : (
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                        <div style={{ padding: '24px', overflowY: 'auto' }}>
                            
                            {/* Client Section */}
                            <div style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                                <div style={{ marginBottom: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                    <label style={{ fontWeight: 600 }}>Client Details</label>
                                    <label style={{ fontSize: '0.9rem', color: '#006ac6', cursor: 'pointer' }}>
                                        <input type="checkbox" checked={isNewClient} onChange={() => setIsNewClient(!isNewClient)} />
                                        &nbsp;New Client?
                                    </label>
                                </div>

                                {!isNewClient ? (
                                    <div style={{ marginBottom: '16px' }}>
                                        <select name="client_id" className="form-input" style={{ width: '100%', padding: '10px' }} value={formData.client_id} onChange={handleChange} required={!isNewClient}>
                                            <option value="">-- Select Client --</option>
                                            {clients.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
                                        </select>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <input placeholder="Full Name" name="full_name" className="form-input" style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }} value={formData.full_name} onChange={handleChange} required={isNewClient} />
                                        <input placeholder="Email" type="email" name="email" className="form-input" style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }} value={formData.email} onChange={handleChange} required={isNewClient} />
                                        <input placeholder="Phone" name="phone_number" className="form-input" style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }} value={formData.phone_number} onChange={handleChange} />
                                        <input placeholder="Address" name="address" className="form-input" style={{ padding: '10px', border: '1px solid #ddd', borderRadius: '6px' }} value={formData.address} onChange={handleChange} required={isNewClient} />
                                    </div>
                                )}
                            </div>

                            {/* Job Details */}
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label>Service</label>
                                    <select name="service_item_id" className="form-input" style={{ width: '100%', padding: '10px' }} value={formData.service_item_id} onChange={handleServiceChange} required>
                                        <option value="">-- Select Service --</option>
                                        {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Price (R)</label>
                                    <input type="number" name="service_price" className="form-input" style={{ width: '100%', padding: '10px' }} value={formData.service_price} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Date</label>
                                    <input type="date" name="scheduled_date" className="form-input" style={{ width: '100%', padding: '10px' }} value={formData.scheduled_date} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Time</label>
                                    <input type="time" name="scheduled_time" className="form-input" style={{ width: '100%', padding: '10px' }} value={formData.scheduled_time} onChange={handleChange} required />
                                </div>
                                <div className="form-group">
                                    <label>Assign Staff</label>
                                    <select name="staff_id" className="form-input" style={{ width: '100%', padding: '10px' }} value={formData.staff_id} onChange={handleChange} required>
                                        <option value="">-- Select Staff --</option>
                                        {staffList.map(s => <option key={s.id} value={s.id}>{s.full_name}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Frequency</label>
                                    <select name="service_frequency" className="form-input" style={{ width: '100%', padding: '10px' }} value={formData.service_frequency} onChange={handleChange}>
                                        <option value="Once-Off">Once-Off</option>
                                        <option value="Weekly">Weekly</option>
                                        <option value="Monthly">Monthly</option>
                                    </select>
                                </div>
                            </div>

                        </div>
                        
                        {/* Footer Actions */}
                        <div style={{ padding: '20px 24px', borderTop: '1px solid #e5e7eb', backgroundColor: '#f9fafb', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                            <button type="button" onClick={onClose} style={{ background: 'transparent', border: '1px solid #d1d5db', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                            <button type="submit" style={{ backgroundColor: '#0f172a', color: 'white', padding: '10px 20px', borderRadius: '6px', border: 'none', cursor: 'pointer', opacity: isSaving ? 0.7 : 1 }} disabled={isSaving}>
                                {isSaving ? 'Creating...' : 'Create Booking'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default ScheduleBookingModal;