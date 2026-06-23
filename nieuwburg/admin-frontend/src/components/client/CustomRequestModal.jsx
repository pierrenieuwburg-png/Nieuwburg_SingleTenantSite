import React, { useState } from 'react';

const CustomRequestModal = ({ isOpen, onClose, selectedCategory = 'Other' }) => {
    const [formData, setFormData] = useState({
        service_type: selectedCategory,
        property_type: 'Residential',
        urgency: 'Flexible (Within a week)',
        budget: '',
        description: ''
    });
    const [photos, setPhotos] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleTextChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e) => {
        setPhotos(Array.from(e.target.files));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        // We use FormData because we are uploading files (photos)
        const submitData = new FormData();
        submitData.append('service_type', formData.service_type);
        submitData.append('property_type', formData.property_type);
        submitData.append('urgency', formData.urgency);
        submitData.append('budget', formData.budget || 0);
        submitData.append('description', formData.description);
        
        photos.forEach(photo => {
            submitData.append('photos', photo);
        });

        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch('/client/api/requests/custom', {
                method: 'POST',
                headers: { 'X-CSRFToken': csrfToken },
                body: submitData
            });

            if (res.ok) {
                alert("🚀 Request broadcasted to nearby pros!");
                onClose();
            } else {
                const err = await res.json();
                alert(`Error: ${err.message}`);
            }
        } catch (error) {
            console.error("Submission failed", error);
            alert("Network error.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
            backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', 
            justifyContent: 'center', alignItems: 'center', zIndex: 10000
        }}>
            <div style={{
                background: 'white', padding: '2rem', borderRadius: '12px', 
                width: '100%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto'
            }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h2 style={{ margin: 0, color: '#1f2937' }}>Request {selectedCategory}</h2>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '1.5rem', cursor: 'pointer' }}>&times;</button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Property Type</label>
                        <select name="property_type" value={formData.property_type} onChange={handleTextChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
                            <option>Residential</option>
                            <option>Commercial</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Timeline / Urgency</label>
                        <select name="urgency" value={formData.urgency} onChange={handleTextChange} style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }}>
                            <option>Emergency (ASAP)</option>
                            <option>Within 24-48 Hours</option>
                            <option>Flexible (Within a week)</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Estimated Budget (Optional)</label>
                        <input type="number" name="budget" value={formData.budget} onChange={handleTextChange} placeholder="R 0.00" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc' }} />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Upload Photos of the Issue</label>
                        <input type="file" multiple accept="image/*" onChange={handleFileChange} style={{ width: '100%', padding: '10px', border: '1px dashed #ccc', borderRadius: '6px' }} />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Describe the job</label>
                        <textarea name="description" value={formData.description} onChange={handleTextChange} required rows="4" placeholder="What exactly do you need done?" style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #ccc', resize: 'vertical' }}></textarea>
                    </div>

                    <button type="submit" disabled={isSubmitting} style={{
                        padding: '14px', background: isSubmitting ? '#9ca3af' : '#006ac6', 
                        color: 'white', border: 'none', borderRadius: '8px', 
                        fontWeight: 'bold', fontSize: '1.1rem', cursor: isSubmitting ? 'not-allowed' : 'pointer', marginTop: '10px'
                    }}>
                        {isSubmitting ? 'Broadcasting...' : 'Get Quotes Now'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default CustomRequestModal;