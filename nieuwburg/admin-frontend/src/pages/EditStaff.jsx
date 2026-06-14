import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';

// Simple InputField and TextAreaField components (reuse if available)
const InputField = ({ label, id, name, type = 'text', value = '', onChange, required = false, disabled = false, ...props }) => (
    <div className="form-group">
        <label htmlFor={id} className="form-label">{label}</label>
        <input
            type={type}
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            className="form-control"
            required={required}
            disabled={disabled}
            {...props}
        />
    </div>
);

const TextAreaField = ({ label, id, name, value = '', onChange, required = false, rows = 3, disabled = false, ...props }) => (
    <div className="form-group">
        <label htmlFor={id} className="form-label">{label}</label>
        <textarea
            id={id}
            name={name}
            value={value}
            onChange={onChange}
            className="form-control"
            required={required}
            rows={rows}
            disabled={disabled}
            {...props}
        />
    </div>
);

const CheckboxField = ({ label, id, name, checked = false, onChange, disabled = false, ...props }) => (
     <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
        <input
            type="checkbox"
            id={id}
            name={name}
            checked={checked}
            onChange={onChange}
            disabled={disabled}
            style={{ width: '20px', height: '20px' }}
            {...props}
        />
        {/* Label requires htmlFor */}
        <label htmlFor={id} style={{ marginBottom: 0 }}>{label}</label>
    </div>
);


function EditStaff() {
    const { staffId } = useParams();
    const navigate = useNavigate();
    const [staffMember, setStaffMember] = useState(null); // Holds the fetched staff data
    const [formData, setFormData] = useState({ // Holds the current form input values
        full_name: '',
        phone_number: '',
        address: '',
        id_number: '',
        strengths: '',
        notes: '',
        has_id_copy: false,
        has_drivers_license: false,
        has_criminal_check: false,
    });
    const [profileImageFile, setProfileImageFile] = useState(null); // For new profile image upload
    const [documentFiles, setDocumentFiles] = useState([]); // For new document uploads
    const [profilePreview, setProfilePreview] = useState('/static/img/avatar_picture_profile_user_icon.png'); // For image preview
    const [isLoading, setIsLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);
    const [successMessage, setSuccessMessage] = useState(null);
    const [csrfToken, setCsrfToken] = useState('');
    const fileInputRef = useRef(null); // Ref for profile image input
    const docsInputRef = useRef(null); // Ref for documents input

    // Get CSRF token
    useEffect(() => {
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
        setCsrfToken(token || '');
    }, []);

    // Fetch Staff Details on initial load
    useEffect(() => {
        const fetchStaffDetails = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/admin/staff/${staffId}`); // API endpoint
                if (!response.ok) throw new Error('Failed to fetch staff details');
                const data = await response.json();
                setStaffMember(data);
                // Pre-populate form data from fetched profile
                const profile = data.profile || {};
                setFormData({
                    full_name: profile.full_name || '',
                    phone_number: profile.phone_number || '',
                    address: profile.address || '',
                    id_number: profile.id_number || '',
                    strengths: profile.strengths || '',
                    notes: profile.notes || '',
                    has_id_copy: profile.has_id_copy || false,
                    has_drivers_license: profile.has_drivers_license || false,
                    has_criminal_check: profile.has_criminal_check || false,
                });
                // Set initial profile image preview
                 const defaultAvatar = '/static/img/avatar_picture_profile_user_icon.png';
                 setProfilePreview(profile.profile_image ? `/static/uploads/${profile.profile_image}` : defaultAvatar);

            } catch (err) {
                console.error("Fetch error:", err);
                setError(`Error loading staff data: ${err.message}`);
            } finally {
                setIsLoading(false);
            }
        };
        fetchStaffDetails();
    }, [staffId]);

    // Handle text/checkbox input changes
    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // Handle profile image file selection
    const handleProfileImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfileImageFile(file);
            // Create preview URL
            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePreview(reader.result);
            };
            reader.readAsDataURL(file);
        } else {
             // Reset if no file selected
             setProfileImageFile(null);
             const defaultAvatar = '/static/img/avatar_picture_profile_user_icon.png';
             setProfilePreview(staffMember?.profile?.profile_image ? `/static/uploads/${staffMember.profile.profile_image}` : defaultAvatar);
        }
    };

    // Handle document file selection
    const handleDocumentChange = (e) => {
        setDocumentFiles(Array.from(e.target.files)); // Store FileList as array
    };


    // Handle Form Submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);
        setSuccessMessage(null);

        if (!csrfToken) {
            setError("Cannot submit: CSRF token missing.");
            setIsSubmitting(false);
            return;
        }

        // Use FormData because we might have file uploads
        const submissionData = new FormData();

        // Append text fields from formData state
        Object.entries(formData).forEach(([key, value]) => {
             // Send boolean values as 'true'/'false' strings if needed by backend, or handle on backend
            submissionData.append(key, typeof value === 'boolean' ? String(value) : value);
        });

        // Append profile image file if selected
        if (profileImageFile) {
            submissionData.append('profile_image', profileImageFile);
        }

        // Append document files if selected
        documentFiles.forEach((file) => {
            submissionData.append('upload_documents', file);
        });

        try {
            const response = await fetch(`/api/admin/staff/${staffId}`, {
                method: 'PUT',
                headers: {
                    'X-CSRFToken': csrfToken,
                    // 'Content-Type': 'multipart/form-data' // Browser sets this automatically with FormData
                },
                body: submissionData,
            });

            const result = await response.json();

            if (response.ok) {
                setSuccessMessage(result.message || "Staff profile updated successfully.");
                setTimeout(() => navigate(`/staff/${staffId}`), 1500);
                // Optionally update local state if needed, or rely on navigation back
                setStaffMember(result.staffMember); // Update local state with returned data
                 // Reset file inputs visually (doesn't clear FormData state, but looks better)
                if (fileInputRef.current) fileInputRef.current.value = "";
                if (docsInputRef.current) docsInputRef.current.value = "";
                setProfileImageFile(null);
                setDocumentFiles([]);
                // Optionally navigate back after a delay
                
            } else {
                throw new Error(result.message || 'Failed to update staff profile.');
            }
        } catch (err) {
            console.error("Update error:", err);
            setError(`Update failed: ${err.message}`);
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) return <div className="loading-indicator">Loading staff data...</div>;
    // Show error only if loading failed completely
    if (error && !staffMember) return <div className="flash error">{error}</div>;
     // Handle case where staffMember is null after loading without error
    if (!staffMember) return <p>Staff member not found.</p>;


    return (
        <div>
            <div className="admin-header">
                <h1>Edit: {formData.full_name || staffMember.email}</h1>
                <div>
                    {/* Link back to the detail view */}
                    <Link to={`/staff/${staffId}`} className="cta-outline">← Back</Link>
                    <Link to="/staff" className="cta-outline" style={{ marginLeft: '10px' }}>Back to Staff List</Link>
                </div>
            </div>

            {/* Display submission success/error messages */}
            {error && <div className="flash error" style={{ marginBottom: '20px' }}>{error}</div>}
            {successMessage && <div className="flash success" style={{ marginBottom: '20px' }}>{successMessage}</div>}

            <div className="admin-section">
                {/* Mimic structure of admin_edit_staff.html */}
                <form onSubmit={handleSubmit} className="profile-form" style={{ maxWidth: '600px', margin: 0 }}>
                    {/* Profile Image Section */}
                     <div className="form-group profile-image-edit" style={{ alignItems: 'center', marginBottom: '20px' }}>
                        <img
                            src={profilePreview}
                            alt="Profile Preview"
                            id="profile-preview"
                             style={{ width: '120px', height: '120px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #eee' }}
                             // Add error handler for preview
                              onError={(e) => { e.target.onerror = null; e.target.src='/static/img/avatar_picture_profile_user_icon.png'}}
                        />
                        <label htmlFor="profile_image_upload" className="cta-outline">Change Photo</label>
                        <input
                            type="file"
                            id="profile_image_upload"
                            name="profile_image" // Matches API expectation
                            accept="image/png, image/jpeg, image/gif"
                            onChange={handleProfileImageChange}
                            ref={fileInputRef}
                            className="hidden" // Hide default input
                         />
                        {/* Add remove picture button if needed */}
                    </div>

                    <InputField label="Full Name" id="full_name" name="full_name" value={formData.full_name} onChange={handleChange} required />
                    {/* Email is typically not editable */}
                    <InputField label="Email (Cannot be changed)" id="email" name="email" type="email" value={staffMember.email} disabled />
                    <InputField label="Phone Number" id="phone_number" name="phone_number" type="tel" value={formData.phone_number} onChange={handleChange} />
                    <TextAreaField label="Physical Address" id="address" name="address" value={formData.address} onChange={handleChange} rows={3} />
                    <InputField label="ID Number (13 digits)" id="id_number" name="id_number" value={formData.id_number} onChange={handleChange} maxLength={13} />

                    <hr />

                    <h3>HR & Vetting</h3>
                    <TextAreaField label="Strengths / Key Skills" id="strengths" name="strengths" value={formData.strengths} onChange={handleChange} rows={3} />

                    {/* Vetting Checkboxes */}
                    <div style={{ backgroundColor: '#f9f9f9', padding: '15px', borderRadius: '8px', marginBottom: '20px' }}>
                         <CheckboxField label="Copy of ID on file" id="has_id_copy" name="has_id_copy" checked={formData.has_id_copy} onChange={handleChange} />
                         <CheckboxField label="Driver's license on file" id="has_drivers_license" name="has_drivers_license" checked={formData.has_drivers_license} onChange={handleChange} />
                         <CheckboxField label="Criminal record check complete" id="has_criminal_check" name="has_criminal_check" checked={formData.has_criminal_check} onChange={handleChange} />
                    </div>

                     {/* Document Upload */}
                     <div className="form-group">
                        <label htmlFor="upload_documents" className="form-label">Upload New Documents</label>
                        <input
                            type="file"
                            id="upload_documents"
                            name="upload_documents" // Matches API expectation
                            className="form-control"
                            onChange={handleDocumentChange}
                            ref={docsInputRef}
                            multiple // Allow multiple file selection
                        />
                         {/* Display currently uploaded files (from staffMember.profile.documents) */}
                         {staffMember.profile?.documents && staffMember.profile.documents.length > 0 && (
                            <div style={{ marginTop: '10px', fontSize: '0.9em' }}>
                                <p><strong>Current Documents:</strong></p>
                                <ul>
                                     {staffMember.profile.documents.map((doc, index) => (
                                        <li key={index}>
                                            <a href={`/static/uploads/${doc}`} target="_blank" rel="noopener noreferrer">
                                                {doc.includes('_') ? doc.split('_').slice(1).join('_') || doc : doc}
                                            </a>
                                            {/* Add delete button per document if needed */}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>

                    <hr />

                    <TextAreaField label="Notes" id="notes" name="notes" value={formData.notes} onChange={handleChange} rows={6} />

                    <button type="submit" className="cta" disabled={isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save Changes'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default EditStaff;