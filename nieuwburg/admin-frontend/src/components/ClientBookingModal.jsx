import React, { useState } from 'react';
import { BarLoader } from 'react-spinners';
import { createBooking } from '../services/clientApi';

const ClientBookingModal = ({ isOpen, onClose, serviceType, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        frequency: 'Once-off',
        date: '',
        time: '09:00',
        notes: ''
    });

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await createBooking({
                service_type: serviceType,
                ...formData
            });
            alert("Booking request sent! We will confirm shortly.");
            onSuccess(); // Refresh parent data
            onClose();
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Styling similar to your other modals
    const overlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    };
    const modalStyle = {
        backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '500px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <h2 style={{marginTop: 0}}>Book {serviceType}</h2>
                <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
                    
                    <label>
                        <strong>When?</strong>
                        <div style={{display: 'flex', gap: '10px', marginTop: '5px'}}>
                            <input type="date" required className="form-input" 
                                style={{flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ddd'}}
                                onChange={e => setFormData({...formData, date: e.target.value})}
                            />
                            <input type="time" required className="form-input" 
                                style={{width: '100px', padding: '8px', borderRadius: '6px', border: '1px solid #ddd'}}
                                value={formData.time}
                                onChange={e => setFormData({...formData, time: e.target.value})}
                            />
                        </div>
                    </label>

                    <label>
                        <strong>Frequency</strong>
                        <select className="form-input" 
                            style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', marginTop: '5px'}}
                            onChange={e => setFormData({...formData, frequency: e.target.value})}
                        >
                            <option>Once-off</option>
                            <option>Weekly</option>
                            <option>Bi-Weekly</option>
                            <option>Monthly</option>
                        </select>
                    </label>

                    <label>
                        <strong>Notes / Specific Requirements</strong>
                        <textarea className="form-input" rows="3"
                            style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', marginTop: '5px'}}
                            placeholder="E.g. I have 3 bedrooms, please bring vacuum..."
                            onChange={e => setFormData({...formData, notes: e.target.value})}
                        ></textarea>
                    </label>

                    <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem'}}>
                        <button type="button" onClick={onClose} style={{padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#666'}}>Cancel</button>
                        <button type="submit" disabled={loading} style={{
                            padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                            background: '#0f172a', color: 'white', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px'
                        }}>
                            {loading ? <BarLoader color="white" height={4} width={50} /> : 'Request Booking'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
export default ClientBookingModal;