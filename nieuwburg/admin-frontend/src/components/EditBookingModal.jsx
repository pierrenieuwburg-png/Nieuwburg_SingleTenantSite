import React, { useState, useEffect } from 'react';
import { BarLoader } from 'react-spinners';

const EditBookingModal = ({ isOpen, jobId, onClose, onUpdate }) => {
    const [job, setJob] = useState(null);
    const [staffList, setStaffList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [csrfToken, setCsrfToken] = useState('');

    // Form State
    const [status, setStatus] = useState('');
    const [staffId, setStaffId] = useState('');
    const [scheduledDate, setScheduledDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        setCsrfToken(token || '');

        if (isOpen && jobId) {
            fetchData();
        }
    }, [isOpen, jobId]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const jobRes = await fetch(`/api/admin/jobs/${jobId}`);
            if (!jobRes.ok) throw new Error('Failed to fetch job details');
            const jobData = await jobRes.json();
            
            setJob(jobData);
            setStatus(jobData.status || 'Scheduled');
            setStaffId(jobData.assigned_staff_id || '');
            setScheduledDate(jobData.scheduled_date || '');
            setStartTime(jobData.start_time || '09:00');
            setNotes(jobData.notes || '');

            const staffRes = await fetch('/api/admin/staff/all');
            if (staffRes.ok) {
                const staffData = await staffRes.json();
                setStaffList(Array.isArray(staffData) ? staffData : []);
            }
        } catch (err) {
            console.error("Error fetching data:", err);
            alert("Failed to load booking details.");
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const updateData = {
                scheduled_date: scheduledDate,
                start_time: startTime,
                staff_id: staffId,
                status: status,
                notes: notes
            };

            const response = await fetch(`/api/admin/jobs/${jobId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(updateData)
            });

            if (!response.ok) throw new Error('Failed to update job');
            
            onUpdate(); 
        } catch (err) {
            alert(err.message);
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm("Delete this job? This cannot be undone.")) {
            try {
                const response = await fetch(`/api/admin/jobs/${jobId}`, {
                    method: 'DELETE',
                    headers: { 'X-CSRFToken': csrfToken }
                });
                if (response.ok) onUpdate();
            } catch (err) {
                alert("Error deleting job");
            }
        }
    };

    if (!isOpen) return null;

    // Retain ONLY the absolute necessary overlay styles to beat FullCalendar
    const overlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', 
        justifyContent: 'center', alignItems: 'center', 
        zIndex: 99999, backdropFilter: 'blur(3px)'
    };

    return (
        <div style={overlayStyle}>
            <div className="modal-content auth-modal-content" style={{ width: '90%', maxWidth: '500px', maxHeight: '90vh', overflowY: 'auto', padding: '30px' }}>
                <button onClick={onClose} className="modal-close" aria-label="Close modal">&times;</button>
                
                <h2 className="auth-title" style={{ textAlign: 'left', marginBottom: '20px' }}>Booking Details</h2>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
                        <BarLoader color="#006ac6" />
                    </div>
                ) : (
                    <div className="auth-form-modal active" style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                        
                        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '10px' }}>
                            <h4 style={{ margin: '0 0 5px 0', color: '#1f2937', fontSize: '1.1rem' }}>{job?.client_name}</h4>
                            <p style={{ margin: 0, color: '#6b7280', fontSize: '0.9rem' }}>{job?.service_name}</p>
                        </div>

                        <div style={{ display: 'flex', gap: '15px' }}>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Date</label>
                                <input type="date" className="form-control" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                            </div>
                            <div className="form-group" style={{ flex: 1 }}>
                                <label className="form-label">Time</label>
                                <input type="time" className="form-control" value={startTime} onChange={e => setStartTime(e.target.value)} />
                            </div>
                        </div>
                        
                        <div className="form-group">
                            <label className="form-label">Status</label>
                            <select className="form-control" value={status} onChange={e => setStatus(e.target.value)}>
                                <option value="Scheduled">Scheduled</option>
                                <option value="In Progress">In Progress</option>
                                <option value="Completed">Completed</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Assigned Staff</label>
                            <select className="form-control" value={staffId} onChange={e => setStaffId(e.target.value)}>
                                <option value="">-- Unassigned --</option>
                                {staffList.map(s => (
                                    <option key={s.id} value={s.id}>{s.full_name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Private Notes</label>
                            <textarea className="form-control" rows="3" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Entry codes, special requests, etc." />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '20px', borderTop: '1px solid #e5e7eb' }}>
                            <button onClick={handleDelete} className="cta-danger-outline" style={{ padding: '10px 20px' }}>
                                Delete
                            </button>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={onClose} className="cta-outline" style={{ padding: '10px 20px' }}>
                                    Cancel
                                </button>
                                <button onClick={handleSave} className="cta" disabled={saving} style={{ padding: '10px 20px', opacity: saving ? 0.7 : 1 }}>
                                    {saving ? "Saving..." : "Save Changes"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EditBookingModal;