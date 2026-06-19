import React, { useState, useEffect } from 'react';
import { BarLoader } from 'react-spinners';

function ServiceModal({ isOpen, onClose, onSuccess, serviceToEdit, initialCategoryId }) {
    const [csrfToken, setCsrfToken] = useState("");
    const [categories, setCategories] = useState([]);
    const [clauses, setClauses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    const [formData, setFormData] = useState({
        name: "",
        description: "", 
        category_id: "",
        estimated_time_mins: 60,
        default_rate: "",
        pricing_type: "fixed",
        is_material: false,
        is_variable_price: false,
        is_extra: false, 
        linked_clause_ids: []
    });

    const overlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9999, backdropFilter: 'blur(2px)'
    };

    const contentStyle = {
        backgroundColor: 'white', borderRadius: '12px',
        width: '90%', maxWidth: '700px',
        maxHeight: '90vh', overflowY: 'auto',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
        display: 'flex', flexDirection: 'column'
    };

    useEffect(() => {
        if (!isOpen) return;
        setIsSaving(false);

        if (serviceToEdit) {
            setFormData({
                name: serviceToEdit.name,
                description: serviceToEdit.description || "",
                category_id: serviceToEdit.category_id || "",
                estimated_time_mins: serviceToEdit.estimated_time_mins || 0,
                default_rate: serviceToEdit.default_rate || "",
                pricing_type: serviceToEdit.pricing_type || "fixed",
                is_material: serviceToEdit.is_material || false,
                is_variable_price: serviceToEdit.is_variable_price || false,
                is_extra: serviceToEdit.is_extra || false,
                linked_clause_ids: serviceToEdit.linked_clause_ids || []
            });
        } else {
            setFormData({
                name: "", 
                description: "",
                category_id: initialCategoryId || "",
                estimated_time_mins: 60, 
                default_rate: "",
                pricing_type: "fixed", 
                is_material: false, 
                is_variable_price: false,
                is_extra: false,
                linked_clause_ids: []
            });
        }
        setShowAdvanced(false); 

        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
        setCsrfToken(token || "");

        const fetchData = async () => {
            try {
                const [catRes, clauseRes] = await Promise.all([
                    fetch('/api/admin/service-categories'),
                    fetch('/api/admin/service-clauses')
                ]);
                setCategories(await catRes.json());
                setClauses(await clauseRes.json());
            } catch (e) { console.error(e); } 
            finally { setIsLoading(false); }
        };
        fetchData();
    }, [isOpen, serviceToEdit, initialCategoryId]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handleTypeToggle = (isMaterial) => {
        setFormData(prev => ({
            ...prev,
            is_material: isMaterial,
            pricing_type: isMaterial ? 'unit' : 'fixed' 
        }));
    };

    const handleClauseChange = (e) => {
        const options = e.target.options;
        const selected = [];
        for (let i = 0; i < options.length; i++) {
            if (options[i].selected) selected.push(parseInt(options[i].value));
        }
        setFormData(prev => ({ ...prev, linked_clause_ids: selected }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        const url = serviceToEdit ? `/api/admin/service-items/${serviceToEdit.id}` : '/api/admin/service-items';
        const method = serviceToEdit ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                body: JSON.stringify(formData)
            });
            if (!response.ok) throw new Error("Failed to save service");
            onSuccess();
        } catch (err) {
            alert(err.message);
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div style={overlayStyle}>
            <div style={contentStyle}>
                <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb' }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#111827' }}>{serviceToEdit ? 'Edit Price List Item' : 'Add Price List Item'}</h2>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '28px', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
                </div>

                {isLoading ? <div style={{padding:'50px'}}><BarLoader color="#006ac6" width="100%"/></div> : (
                    <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        
                        <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px'}}>
                            <div className="form-group">
                                <label>Internal Name / Title</label>
                                <input name="name" className="form-input" value={formData.name} onChange={handleChange} required placeholder="e.g. 1-2 Bedroom Home" style={{width: '100%'}} />
                            </div>
                            <div className="form-group">
                                <label>Category</label>
                                <select name="category_id" className="form-input" value={formData.category_id} onChange={handleChange} required style={{width: '100%'}}>
                                    <option value="">-- Select --</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{display: 'flex', background: '#f3f4f6', padding: '4px', borderRadius: '8px'}}>
                            <button type="button" 
                                onClick={() => handleTypeToggle(false)}
                                style={{flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: !formData.is_material ? 'white' : 'transparent', boxShadow: !formData.is_material ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontWeight: !formData.is_material ? 600 : 400}}>
                                🛠️ Service
                            </button>
                            <button type="button" 
                                onClick={() => handleTypeToggle(true)}
                                style={{flex: 1, padding: '8px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: formData.is_material ? 'white' : 'transparent', boxShadow: formData.is_material ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', fontWeight: formData.is_material ? 600 : 400}}>
                                📦 Material / Product
                            </button>
                        </div>

                        <div className="form-group">
                            <label>Quote Description (Scope of Work)</label>
                            <textarea 
                                name="description" 
                                className="form-input" 
                                value={formData.description} 
                                onChange={handleChange} 
                                rows="3" 
                                placeholder="Briefly describe what this includes..."
                                style={{width: '100%', resize: 'vertical', lineHeight: '1.5'}}
                            />
                        </div>

                        <div style={{ backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '8px', border: '1px solid #bae6fd' }}>
                            <h4 style={{margin: '0 0 10px 0', fontSize: '0.9rem', color: '#0369a1'}}>Pricing & Rules</h4>
                            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'}}>
                                <div className="form-group">
                                    <label>Pricing Unit</label>
                                    <select name="pricing_type" className="form-input" value={formData.pricing_type} onChange={handleChange} style={{width: '100%'}}>
                                        {!formData.is_material ? (
                                            <>
                                                <option value="fixed">Fixed Price (Total)</option>
                                                <option value="hourly">Hourly Rate</option>
                                                <option value="sqm">Per Square Meter (m²)</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="unit">Per Item / Unit</option>
                                                <option value="meter">Per Meter (m)</option>
                                                <option value="liter">Per Liter (L)</option>
                                            </>
                                        )}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label>Price (R)</label>
                                    <input type="number" name="default_rate" className="form-input" value={formData.default_rate} onChange={handleChange} placeholder="0.00" step="0.01" style={{width: '100%'}} />
                                </div>
                            </div>
                            <div style={{marginTop: '15px', display: 'flex', flexDirection: 'column', gap: '10px'}}>
                                <label style={{display: 'flex', alignItems: 'center', fontSize: '0.9rem', color: '#0369a1', cursor: 'pointer'}}>
                                    <input type="checkbox" name="is_variable_price" checked={formData.is_variable_price} onChange={handleChange} />
                                    <span style={{ marginLeft: '8px' }}>Show as "From R..." (Variable Price)</span>
                                </label>
                                <label style={{display: 'flex', alignItems: 'center', fontSize: '0.9rem', color: '#be185d', cursor: 'pointer'}}>
                                    <input type="checkbox" name="is_extra" checked={formData.is_extra} onChange={handleChange} />
                                    <span style={{ marginLeft: '8px', fontWeight: 'bold' }}>Treat as an Additional Extra / Add-on</span>
                                </label>
                            </div>
                        </div>

                        {!formData.is_material && (
                            <div className="form-group">
                                <label>Typical Duration (Minutes)</label>
                                <input type="number" name="estimated_time_mins" className="form-input" value={formData.estimated_time_mins} onChange={handleChange} style={{width: '150px'}} />
                            </div>
                        )}

                        <div style={{borderTop: '1px solid #e5e7eb', paddingTop: '10px'}}>
                            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)} style={{background: 'none', border: 'none', color: '#6b7280', fontSize: '0.9rem', cursor: 'pointer', display: 'flex', alignItems: 'center'}}>
                                {showAdvanced ? '▼ Hide Advanced Settings' : '▶ Show Advanced Settings (T&Cs)'}
                            </button>
                            
                            {showAdvanced && (
                                <div style={{marginTop: '15px', padding: '10px', background: '#f9fafb', borderRadius: '8px'}}>
                                    <div className="form-group">
                                        <label>Auto-Attach T&C Clauses</label>
                                        <select multiple name="linked_clause_ids" className="form-input" value={formData.linked_clause_ids} onChange={handleClauseChange} style={{height: '100px', width: '100%'}}>
                                            {clauses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <small style={{color: '#9ca3af'}}>Hold Ctrl to select multiple</small>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                            <button type="button" onClick={onClose} className="cta-outline">Cancel</button>
                            <button type="submit" className="cta" disabled={isSaving}>
                                {isSaving ? 'Saving...' : (serviceToEdit ? 'Update Item' : 'Save Item')}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}

export default ServiceModal;