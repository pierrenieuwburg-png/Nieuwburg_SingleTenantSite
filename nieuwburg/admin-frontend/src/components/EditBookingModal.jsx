import React, { useState, useEffect } from 'react';
import { BarLoader } from 'react-spinners';

function EditBookingModal({ isOpen, jobId, onClose, onUpdate }) {
    const [job, setJob] = useState(null);
    const [staffList, setStaffList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [csrfToken, setCsrfToken] = useState("");

    // Form State
    const [status, setStatus] = useState('');
    const [staffId, setStaffId] = useState('');
    const [date, setDate] = useState('');
    const [time, setTime] = useState('');
    const [notes, setNotes] = useState('');

    useEffect(() => {
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
        setCsrfToken(token || "");

        const fetchData = async () => {
            try {
                // 1. Fetch Job Details
                const jobRes = await fetch(`/api/admin/jobs/${jobId}`);
                const jobData = await jobRes.json();
                setJob(jobData);
                
                // Initialize Form
                setStatus(jobData.status);
                setStaffId(jobData.assigned_staff_id || "");
                setDate(jobData.scheduled_date);
                setTime(jobData.start_time || "09:00");
                setNotes(jobData.notes || "");

                // 2. Fetch Staff Options
                const staffRes = await fetch('/api/admin/staff/all');
                const staffData = await staffRes.json();
                setStaffList(staffData);

            } catch (error) {
                console.error("Error fetching data:", error);
                alert("Failed to load booking details.");
                onClose();
            } finally {
                setIsLoading(false);
            }
        };

        if (isOpen && jobId) fetchData();
    }, [isOpen, jobId, onClose]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const payload = {
                scheduled_date: date,
                start_time: time,
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
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Failed to update");
            
            onUpdate(); // Refresh calendar
        } catch (error) {
            alert(error.message);
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if(!window.confirm("Delete this job? This cannot be undone.")) return;
        try {
            const response = await fetch(`/api/admin/jobs/${jobId}`, {
                method: 'DELETE',
                headers: { 'X-CSRFToken': csrfToken }
            });
            if(response.ok) onUpdate();
        } catch(e) { alert("Error deleting job"); }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{maxWidth: '500px'}}>
                <div className="modal-header">
                    <h2>Booking Details</h2>
                    <button onClick={onClose} className="close-btn">&times;</button>
                </div>

                {isLoading ? <BarLoader color="#006ac6" width="100%" /> : (
                    <div className="modal-body">
                        {/* Read-Only Info */}
                        <div style={{background: '#f3f4f6', padding: '15px', borderRadius: '8px', marginBottom: '20px'}}>
                            <h4 style={{margin: '0 0 5px 0', color: '#002244'}}>{job.client_name}</h4>
                            <p style={{margin: 0, color: '#6b7280', fontSize: '0.9rem'}}>{job.service_name}</p>
                        </div>

                        {/* Edit Form */}
                        <div className="form-grid">
                            <div className="form-group">
                                <label>Date</label>
                                <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Time</label>
                                <input type="time" className="form-input" value={time} onChange={e => setTime(e.target.value)} />
                            </div>
                            <div className="form-group">
                                <label>Status</label>
                                <select className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
                                    <option value="Scheduled">Scheduled</option>
                                    <option value="In Progress">In Progress</option>
                                    <option value="Completed">Completed</option>
                                    <option value="Cancelled">Cancelled</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label>Assigned Staff</label>
                                <select className="form-input" value={staffId} onChange={e => setStaffId(e.target.value)}>
                                    <option value="">-- Unassigned --</option>
                                    {staffList.map(s => (
                                        <option key={s.id} value={s.id}>{s.full_name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group full-width">
                                <label>Private Notes</label>
                                <textarea className="form-input" rows="3" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Entry codes, special requests, etc."></textarea>
                            </div>
                        </div>

                        <div className="modal-actions" style={{justifyContent: 'space-between'}}>
                            <button onClick={handleDelete} className="cta-danger-outline">Delete</button>
                            <div>
                                <button onClick={onClose} className="cta-outline" style={{marginRight: '10px'}}>Cancel</button>
                                <button onClick={handleSave} className="cta" disabled={isSaving}>
                                    {isSaving ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default EditBookingModal;