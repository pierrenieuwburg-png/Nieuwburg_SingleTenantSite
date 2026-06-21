import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

function StaffJobExecution() {
    const { jobId } = useParams();
    const navigate = useNavigate();
    const [job, setJob] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [nextTaskSuggestion, setNextTaskSuggestion] = useState('');
    const [notes, setNotes] = useState('');
    
    const fileInputRef = useRef(null);
    const [activePhotoType, setActivePhotoType] = useState('General');
    const [uploadedPhotos, setUploadedPhotos] = useState([]);

    useEffect(() => {
        fetchJobData();
    }, [jobId]);

    const fetchJobData = async () => {
        try {
            const response = await fetch(`/api/staff/jobs/${jobId}/tasks`);
            if (response.ok) {
                const data = await response.json();
                setJob(data.job);
                setTasks(data.tasks);
            }
        } catch (error) {
            console.error("Failed to fetch job data", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleTask = async (taskId, currentStatus) => {
        // Optimistic UI update
        setTasks(tasks.map(t => t.id === taskId ? { ...t, is_completed: !currentStatus } : t));
        
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
        await fetch(`/api/staff/tasks/${taskId}/toggle`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
            body: JSON.stringify({ is_completed: !currentStatus })
        });
    };

    const triggerCamera = (photoType) => {
        setActivePhotoType(photoType);
        fileInputRef.current.click();
    };

    const handlePhotoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        const formData = new FormData();
        formData.append('photo', file);
        formData.append('photo_type', activePhotoType);

        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

        try {
            const response = await fetch(`/api/staff/jobs/${jobId}/photos`, {
                method: 'POST',
                headers: { 'X-CSRFToken': csrfToken },
                body: formData
            });
            const result = await response.json();
            if (response.ok) {
                setUploadedPhotos([...uploadedPhotos, { type: activePhotoType, url: result.photo_url }]);
                alert(`${activePhotoType} photo uploaded successfully!`);
            }
        } catch (error) {
            alert('Failed to upload photo.');
        } finally {
            setUploading(false);
            e.target.value = null; // reset input
        }
    };

    const handleCompleteJob = async () => {
        if (!window.confirm("Are you sure you want to complete this job?")) return;

        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
        try {
            const response = await fetch(`/api/staff/jobs/${jobId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                body: JSON.stringify({ suggested_next_task: nextTaskSuggestion, notes: notes })
            });

            if (response.ok) {
                alert('Job Completed! Great work.');
                window.location.href = '/staff/dashboard'; // Send them back to their Jinja schedule
            }
        } catch (error) {
            alert('Error completing job.');
        }
    };

    if (isLoading) return <div style={{ padding: '20px', textAlign: 'center' }}>Loading Job Details...</div>;
    if (!job) return <div style={{ padding: '20px', textAlign: 'center' }}>Job not found.</div>;

    const completedCount = tasks.filter(t => t.is_completed).length;
    const progress = tasks.length === 0 ? 0 : Math.round((completedCount / tasks.length) * 100);

    return (
        <div style={{ maxWidth: '600px', margin: '0 auto', padding: '20px', backgroundColor: '#f8f9fa', minHeight: '100vh', fontFamily: 'sans-serif' }}>
            
            {/* Header */}
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                <h2 style={{ margin: '0 0 5px 0', color: '#1f2937' }}>{job.client_name}</h2>
                <p style={{ margin: '0 0 10px 0', color: '#6b7280', fontSize: '14px' }}>📍 {job.address}</p>
                <div style={{ display: 'inline-block', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold' }}>
                    {job.service_name}
                </div>
            </div>

            {/* Progress Bar */}
            <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px', fontSize: '14px', color: '#4b5563' }}>
                    <span>Checklist Progress</span>
                    <span>{progress}%</span>
                </div>
                <div style={{ width: '100%', height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ width: `${progress}%`, height: '100%', backgroundColor: '#10b981', transition: 'width 0.3s' }}></div>
                </div>
            </div>

            {/* Checklist */}
            <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', overflow: 'hidden', marginBottom: '20px' }}>
                {tasks.map(task => (
                    <div key={task.id} 
                         onClick={() => handleToggleTask(task.id, task.is_completed)}
                         style={{ display: 'flex', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid #f3f4f6', cursor: 'pointer', backgroundColor: task.is_rotational ? '#fffbeb' : 'white' }}>
                        
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', border: `2px solid ${task.is_completed ? '#10b981' : '#d1d5db'}`, backgroundColor: task.is_completed ? '#10b981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginRight: '15px', transition: 'all 0.2s' }}>
                            {task.is_completed && <span style={{ color: 'white', fontSize: '14px' }}>✓</span>}
                        </div>
                        
                        <div style={{ flex: 1, color: task.is_completed ? '#9ca3af' : '#1f2937', textDecoration: task.is_completed ? 'line-through' : 'none', fontWeight: task.is_rotational ? 'bold' : 'normal' }}>
                            {task.task_name}
                        </div>
                    </div>
                ))}
            </div>

            {/* Photo Upload Section */}
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#1f2937' }}>📸 Job Photos</h3>
                <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '15px' }}>Take a before and after photo of the Rotational Deep Clean task.</p>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <button onClick={() => triggerCamera('Before')} style={{ padding: '12px', backgroundColor: '#f3f4f6', border: '1px dashed #d1d5db', borderRadius: '8px', cursor: 'pointer', color: '#4b5563' }}>
                        {uploading && activePhotoType === 'Before' ? 'Uploading...' : '+ Add Before'}
                    </button>
                    <button onClick={() => triggerCamera('After')} style={{ padding: '12px', backgroundColor: '#f3f4f6', border: '1px dashed #d1d5db', borderRadius: '8px', cursor: 'pointer', color: '#4b5563' }}>
                        {uploading && activePhotoType === 'After' ? 'Uploading...' : '+ Add After'}
                    </button>
                </div>

                {/* Hidden File Input (capture="environment" opens rear camera on phones) */}
                <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment" 
                    ref={fileInputRef} 
                    style={{ display: 'none' }} 
                    onChange={handlePhotoUpload} 
                />
            </div>

            {/* Completion Form */}
            <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '12px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', marginBottom: '30px' }}>
                <h3 style={{ margin: '0 0 15px 0', fontSize: '16px', color: '#1f2937' }}>📝 Wrap Up</h3>
                
                <label style={{ display: 'block', fontSize: '13px', color: '#4b5563', marginBottom: '5px' }}>Suggest next rotational task:</label>
                <input 
                    type="text" 
                    value={nextTaskSuggestion} 
                    onChange={(e) => setNextTaskSuggestion(e.target.value)}
                    placeholder="e.g., Wash all skirting boards"
                    style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', marginBottom: '15px', boxSizing: 'border-box' }}
                />

                <label style={{ display: 'block', fontSize: '13px', color: '#4b5563', marginBottom: '5px' }}>Job Notes (Optional):</label>
                <textarea 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any issues or things the client should know?"
                    style={{ width: '100%', padding: '10px', border: '1px solid #d1d5db', borderRadius: '6px', minHeight: '80px', boxSizing: 'border-box' }}
                />
            </div>

            <button 
                onClick={handleCompleteJob}
                style={{ width: '100%', padding: '15px', backgroundColor: '#006ac6', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginBottom: '40px', boxShadow: '0 4px 12px rgba(0, 106, 198, 0.3)' }}>
                Complete Job & Submit Report
            </button>
        </div>
    );
}

export default StaffJobExecution;