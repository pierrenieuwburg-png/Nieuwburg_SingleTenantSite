import React, { useState } from 'react';
import { BarLoader } from 'react-spinners';
import { createCustomRequest } from '../services/clientApi';

const CustomRequestModal = ({ isOpen, onClose, categoryName, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [photos, setPhotos] = useState([]);
    const [formData, setFormData] = useState({
        propertyType: 'Residential (Home/Apartment)',
        urgency: 'Flexible / Planning',
        budget: 0,
        description: ''
    });

    if (!isOpen) return null;

    const handlePhotoChange = (e) => {
        // Limit to 5 files to protect server payload
        const selectedFiles = Array.from(e.target.files).slice(0, 5);
        setPhotos(selectedFiles);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (!window.confirm("Are you ready to submit your request? No further edits can be made once submitted to the providers.")) return;

        setLoading(true);
        
        // We use FormData to package text data along with binary image files
        const payload = new FormData();
        payload.append('service_type', categoryName);
        payload.append('property_type', formData.propertyType);
        payload.append('urgency', formData.urgency);
        payload.append('budget', formData.budget);
        payload.append('description', formData.description);
        
        photos.forEach(photo => {
            payload.append('photos', photo);
        });

        try {
            await createCustomRequest(payload);
            alert("Quote request submitted successfully! Providers will review your details.");
            if (onSuccess) onSuccess(); 
            onClose();
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const getPlaceholder = (cat) => {
        if (cat?.toLowerCase().includes('plumbing')) return "E.g., The pipe under my kitchen sink is leaking. It is a copper pipe...";
        if (cat?.toLowerCase().includes('carpentry')) return "E.g., I need custom shelving built for a 3m x 2m wall...";
        return "Please describe the scope of the project, any specific materials needed, and current conditions...";
    };

    // Styling (matching your standard modal overlays)
    const overlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    };

    const modalStyle = {
        backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '600px',
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                <h2 style={{marginTop: 0, color: '#1f2937'}}>Request a Quote: {categoryName}</h2>
                <p style={{ color: '#6b7280', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                    Provide as much detail as possible so we can give you an accurate, custom quote.
                </p>

                <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1.25rem'}}>
                    
                    {/* Property Context */}
                    <div className="form-group">
                        <label style={{fontWeight: 600, color: '#374151', display: 'block', marginBottom: '8px'}}>Property Type</label>
                        <div style={{display: 'flex', gap: '15px'}}>
                            <label style={{display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem'}}>
                                <input type="radio" name="propertyType" value="Residential (Home/Apartment)" 
                                    checked={formData.propertyType === 'Residential (Home/Apartment)'}
                                    onChange={e => setFormData({...formData, propertyType: e.target.value})} /> 
                                Residential (Home/Apartment)
                            </label>
                            <label style={{display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem'}}>
                                <input type="radio" name="propertyType" value="Commercial (Office/Retail)" 
                                    checked={formData.propertyType === 'Commercial (Office/Retail)'}
                                    onChange={e => setFormData({...formData, propertyType: e.target.value})} /> 
                                Commercial (Office/Retail)
                            </label>
                        </div>
                    </div>

                    {/* Urgency */}
                    <div className="form-group">
                        <label style={{fontWeight: 600, color: '#374151', display: 'block', marginBottom: '8px'}}>Project Timeline / Urgency</label>
                        <select className="form-input" required
                            value={formData.urgency}
                            onChange={e => setFormData({...formData, urgency: e.target.value})}
                        >
                            <option value="Emergency (ASAP)">Emergency (Needs attention ASAP)</option>
                            <option value="Within 48 hours">Within the next 48 hours</option>
                            <option value="Sometime this week">Sometime this week</option>
                            <option value="Flexible / Planning">Flexible / In planning stages</option>
                        </select>
                    </div>

                    {/* Rough Budget Slider */}
                    <div className="form-group">
                        <label style={{fontWeight: 600, color: '#374151', display: 'block', marginBottom: '8px'}}>
                            Estimated Budget Range (Optional)
                        </label>
                        <div style={{display: 'flex', alignItems: 'center', gap: '15px'}}>
                            <input 
                                type="range" 
                                min="0" max="100000" step="500" 
                                value={formData.budget}
                                onChange={e => setFormData({...formData, budget: e.target.value})}
                                style={{flex: 1, accentColor: '#006ac6'}}
                            />
                            <span style={{fontWeight: 600, minWidth: '80px', textAlign: 'right', color: '#006ac6'}}>
                                {formData.budget == 0 ? 'Not sure' : `R ${Number(formData.budget).toLocaleString()}`}
                            </span>
                        </div>
                    </div>

                    {/* Description */}
                    <div className="form-group">
                        <label style={{fontWeight: 600, color: '#374151', display: 'block', marginBottom: '8px'}}>Project Details</label>
                        <textarea className="form-input" rows="4" required
                            placeholder={getPlaceholder(categoryName)}
                            value={formData.description}
                            onChange={e => setFormData({...formData, description: e.target.value})}
                        ></textarea>
                    </div>

                    {/* Photo Uploads */}
                    <div className="form-group" style={{ background: '#f9fafb', padding: '15px', borderRadius: '8px', border: '1px dashed #cbd5e1' }}>
                        <label style={{fontWeight: 600, color: '#374151', display: 'block', marginBottom: '5px'}}>
                            Attach Photos (Max 5)
                        </label>
                        <p style={{fontSize: '0.8rem', color: '#64748b', marginBottom: '10px', marginTop: 0}}>
                            Pictures help professionals provide highly accurate quotes instantly.
                        </p>
                        <input 
                            type="file" 
                            accept="image/*" 
                            multiple 
                            onChange={handlePhotoChange}
                            className="form-input"
                            style={{ background: 'white' }}
                        />
                        {photos.length > 0 && (
                            <div style={{marginTop: '10px', fontSize: '0.85rem', color: '#16a34a', fontWeight: 500}}>
                                {photos.length} image(s) selected
                            </div>
                        )}
                    </div>

                    {/* Actions */}
                    <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem'}}>
                        <button type="button" onClick={onClose} style={{padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#64748b', fontWeight: 600}}>Cancel</button>
                        <button type="submit" disabled={loading} className="cta" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {loading ? <BarLoader color="white" height={4} width={50} /> : 'Submit Quote Request'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CustomRequestModal;