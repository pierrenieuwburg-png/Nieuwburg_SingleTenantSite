import React, { useState } from 'react';

function CategoryModal({ isOpen, onClose, onSuccess }) {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [promptQuestion, setPromptQuestion] = useState(""); // <-- NEW STATE
    const [isSaving, setIsSaving] = useState(false);

    // INLINE STYLES for reliability
    const overlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 9999, backdropFilter: 'blur(2px)'
    };

    const contentStyle = {
        backgroundColor: 'white', padding: '0', borderRadius: '12px', width: '90%', maxWidth: '450px',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)', overflow: 'hidden', display: 'flex', flexDirection: 'column'
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");

        try {
            const res = await fetch('/api/admin/service-categories', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': token || '' },
                // Add prompt_question to the payload
                body: JSON.stringify({ name, description, prompt_question: promptQuestion }) 
            });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.message || "Failed to create category");
            }
            
            // Clear form on success
            setName(""); 
            setDescription(""); 
            setPromptQuestion("");
            onSuccess(); 
        } catch (err) {
            alert("Error: " + err.message);
        } finally {
            setIsSaving(false); // ALWAYS reset the saving state
        }
    };

    if (!isOpen) return null;

    return (
        <div style={overlayStyle}>
            <div style={contentStyle}>
                <div style={{ padding: '20px', borderBottom: '1px solid #e5e7eb', backgroundColor: '#f9fafb' }}>
                    <h3 style={{ margin: 0, color: '#111827' }}>Create New Category</h3>
                    <p style={{ margin: '5px 0 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
                        Categories group your services and dictate the flow of the booking wizard.
                    </p>
                </div>
                
                <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>
                            Category Name
                        </label>
                        <input 
                            className="form-input" 
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} 
                            value={name} 
                            onChange={e => setName(e.target.value)} 
                            required 
                            placeholder="e.g. Interior Cleaning"
                        />
                    </div>

                    {/* NEW PROMPT QUESTION FIELD */}
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>
                            Client Prompt Question
                        </label>
                        <input 
                            className="form-input" 
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} 
                            value={promptQuestion} 
                            onChange={e => setPromptQuestion(e.target.value)} 
                            required 
                            placeholder="e.g. What is the size of your home?"
                        />
                        <small style={{ color: '#6b7280', fontSize: '0.8rem' }}>This is the question the client sees before picking an item.</small>
                    </div>
                    
                    <div style={{ marginBottom: '20px' }}>
                        <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.9rem', color: '#374151' }}>
                            Description (Optional)
                        </label>
                        <textarea 
                            className="form-input" 
                            style={{ width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db' }} 
                            value={description} 
                            onChange={e => setDescription(e.target.value)}
                            placeholder="Internal notes about this category..."
                            rows="2"
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                        <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: '6px', border: '1px solid #d1d5db', background: 'white', cursor: 'pointer' }}>Cancel</button>
                        <button type="submit" style={{ padding: '10px 16px', borderRadius: '6px', border: 'none', background: '#0f172a', color: 'white', fontWeight: 500, cursor: 'pointer' }} disabled={isSaving}>
                            {isSaving ? 'Creating...' : 'Create Category'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default CategoryModal;