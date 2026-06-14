import React, { useState, useEffect } from 'react';
import { BarLoader } from 'react-spinners';

// --- Re-usable Component for the Clause Form (from last step) ---
const ClauseForm = ({ currentClause, onSave, onCancel, csrfToken }) => {
  const [name, setName] = useState(currentClause.name || '');
  const [text, setText] = useState(currentClause.text || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    
    const url = currentClause.id 
      ? `/api/admin/service-clauses/${currentClause.id}`
      : '/api/admin/service-clauses';
    const method = currentClause.id ? 'PUT' : 'POST';

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        },
        body: JSON.stringify({ name, text })
      });
      
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to save clause');
      }
      onSave(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="admin-section" style={{background: '#f9fafb', borderTop: '1px solid #e5e7eb'}}>
      <h3>{currentClause.id ? 'Edit Clause' : 'Add New Clause'}</h3>
      {error && <div className="flash error">{error}</div>}
      <div className="form-group">
        <label htmlFor="clause_name">Clause Name</label>
        <input
          id="clause_name" type="text" className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Window Washing Liability"
        />
      </div>
      <div className="form-group" style={{marginTop: '10px'}}>
        <label htmlFor="clause_text">Clause Text</label>
        <textarea
          id="clause_text" className="form-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
        />
      </div>
      <div style={{textAlign: 'right', marginTop: '15px'}}>
        <button type="button" className="cta-outline" onClick={onCancel}>Cancel</button>
        <button type="submit" className="cta" disabled={isSaving} style={{marginLeft: '10px'}}>
          {isSaving ? 'Saving...' : 'Save Clause'}
        </button>
      </div>
    </form>
  );
};

// --- NEW: Component for the Global Info Form ---
const GlobalInfoForm = ({ settings, setSettings, csrfToken, setFlashMessage }) => {
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveGlobal = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFlashMessage(null);

    try {
      const response = await fetch('/api/admin/business-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify({
          // Only send the fields this form is responsible for
          business_name: settings.business_name,
          business_address: settings.business_address,
          registration_number: settings.registration_number,
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setFlashMessage({ type: 'success', text: result.message });
    } catch (err) {
      setFlashMessage({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSaveGlobal} className="admin-section">
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h2>Global Information</h2>
        <button type="submit" className="cta" disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Global Info'}
        </button>
      </div>
      <p>This information is used on all documents (quotes, invoices, etc.).</p>
      
      <div className="form-grid">
        <div className="form-group">
          <label htmlFor="business_name">Business Name</label>
          <input
            id="business_name" name="business_name" type="text"
            className="form-input" value={settings.business_name || ''}
            onChange={handleChange}
          />
        </div>
        <div className="form-group">
          <label htmlFor="registration_number">Registration Number</label>
          <input
            id="registration_number" name="registration_number" type="text"
            className="form-input" value={settings.registration_number || ''}
            onChange={handleChange}
          />
        </div>
      </div>
      <div className="form-group" style={{marginTop: '20px'}}>
        <label htmlFor="business_address">Business Address</label>
        <input
          id="business_address" name="business_address" type="text"
          className="form-input" value={settings.business_address || ''}
          onChange={handleChange}
        />
      </div>
    </form>
  );
};

// --- NEW: Component for the Quoting Tab ---
const QuotingSettingsTab = ({ settings, setSettings, clauses, setClauses, csrfToken, setFlashMessage }) => {
  const [currentClause, setCurrentClause] = useState(null); // null = no form, {} = new, {id...} = editing
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveQuoting = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setFlashMessage(null);
    try {
      const response = await fetch('/api/admin/business-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify({
          // Only send the fields this tab is responsible for
          default_terms: settings.default_terms,
        })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setFlashMessage({ type: 'success', text: result.message });
    } catch (err) {
      setFlashMessage({ type: 'error', text: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Clause Library Handlers
  const handleSaveClause = (savedClause) => {
    if (currentClause.id) {
      setClauses(clauses.map(c => c.id === savedClause.id ? savedClause : c));
    } else {
      setClauses([...clauses, savedClause]);
    }
    setCurrentClause(null);
  };
  
  const handleDeleteClause = async (clauseId) => {
    if (!window.confirm("Are you sure you want to delete this clause?")) return;
    try {
      const response = await fetch(`/api/admin/service-clauses/${clauseId}`, {
        method: 'DELETE',
        headers: { 'X-CSRFToken': csrfToken }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);
      setClauses(clauses.filter(c => c.id !== clauseId));
      setFlashMessage({ type: 'success', text: result.message });
    } catch (err) {
      setFlashMessage({ type: 'error', text: err.message });
    }
  };
  
  return (
    <div className="tab-content-pane">
      {/* --- Default Terms Form --- */}
      <form onSubmit={handleSaveQuoting}>
        <div className="form-group">
          <label htmlFor="default_terms">Default Quoting Terms & Conditions</label>
          <p style={{fontSize: '0.9rem', color: '#6b7280', marginTop: '-10px'}}>
            This is the base set of terms for all new quotes.
          </p>
          <textarea
            id="default_terms" name="default_terms"
            className="form-input" rows={10}
            value={settings.default_terms || ''}
            onChange={handleChange}
          />
        </div>
        <div style={{textAlign: 'right', marginTop: '15px', paddingBottom: '20px'}}>
          <button type="submit" className="cta" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save Quoting Settings'}
          </button>
        </div>
      </form>
      
      {/* --- T&C Clause Library --- */}
      <div style={{borderTop: '2px solid #e5e7eb', paddingTop: '20px'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
          <h2>T&C Clause Library</h2>
          <button 
            type="button" className="cta" 
            onClick={() => setCurrentClause({})}
            disabled={currentClause != null}
          >
            + Add New Clause
          </button>
        </div>
        <p style={{fontSize: '0.9rem', color: '#6b7280', marginTop: '-10px'}}>
          Create re-usable T&C snippets to link to specific services.
        </p>

        {currentClause && (
          <ClauseForm
            currentClause={currentClause}
            onSave={handleSaveClause}
            onCancel={() => setCurrentClause(null)}
            csrfToken={csrfToken}
          />
        )}
        
        <table className="data-table" style={{marginTop: '20px'}}>
          <thead>
            <tr>
              <th>Clause Name</th>
              <th>Clause Text (Snippet)</th>
              <th style={{width: '120px'}}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {clauses.length === 0 && (
              <tr><td colSpan="3">No T&C clauses created yet.</td></tr>
            )}
            {clauses.map(clause => (
              <tr key={clause.id}>
                <td data-label="Name"><strong>{clause.name}</strong></td>
                <td data-label="Snippet">{clause.text.substring(0, 75)}...</td>
                <td data-label="Actions" className="actions-cell">
                  <button type="button" className="cta-outline-small" onClick={() => setCurrentClause(clause)}>
                    Edit
                  </button>
                  <button type="button" className="cta-danger-outline-small" onClick={() => handleDeleteClause(clause.id)} style={{marginLeft: '5px'}}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};


// --- MAIN BUSINESS SETTINGS PAGE ---
function BusinessSettings() {
  const [activeTab, setActiveTab] = useState('quoting'); // Default to 'quoting'
  
  // This state holds ALL settings
  const [settings, setSettings] = useState({
    business_name: '',
    business_address: '',
    registration_number: '',
    default_terms: ''
  });
  const [clauses, setClauses] = useState([]);
  
  const [csrfToken, setCsrfToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [flashMessage, setFlashMessage] = useState(null);

  // --- Fetch initial settings and clauses data ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
      setCsrfToken(token || "");

      try {
        const [settingsRes, clausesRes] = await Promise.all([
          fetch('/api/admin/business-settings'),
          fetch('/api/admin/service-clauses')
        ]);
        
        if (!settingsRes.ok) throw new Error('Failed to fetch settings');
        if (!clausesRes.ok) throw new Error('Failed to fetch clauses');
        
        const settingsData = await settingsRes.json();
        const clausesData = await clausesRes.json();
        
        setSettings(settingsData);
        setClauses(clausesData);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <BarLoader color="#006ac6" width="50%" />
      </div>
    );
  }

  // This prop object is passed down to the components
  const commonProps = {
    settings,
    setSettings,
    csrfToken,
    setFlashMessage,
    clauses,
    setClauses
  };
  
  return (
    <div>
      <div className="admin-header">
        <h1>Business Settings</h1>
        <p>Manage your global business information and module-specific rules.</p>
      </div>

      {flashMessage && (
        <div className={`flash ${flashMessage.type}`} style={{ marginBottom: '20px' }}>
          {flashMessage.text}
        </div>
      )}
      {error && !flashMessage && (
        <div className="flash error" style={{ marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* --- Global Settings Form (Always visible) --- */}
      <GlobalInfoForm {...commonProps} />
      
      {/* --- NEW: Horizontal Tab Navigation --- */}
      <div className="tabs-nav admin-section" style={{marginTop: '20px'}}>
        <button 
          className={`tabs-nav-button ${activeTab === 'quoting' ? 'active' : ''}`}
          onClick={() => setActiveTab('quoting')}
        >
          <i className="fa-solid fa-file-invoice fa-fw"></i> Quoting
        </button>
        <button 
          className={`tabs-nav-button ${activeTab === 'invoicing' ? 'active' : ''}`}
          onClick={() => setActiveTab('invoicing')}
        >
          <i className="fa-solid fa-file-invoice-dollar fa-fw"></i> Invoicing & Payments
        </button>
        <button 
          className={`tabs-nav-button ${activeTab === 'bookings' ? 'active' : ''}`}
          onClick={() => setActiveTab('bookings')}
        >
          <i className="fa-solid fa-calendar-check fa-fw"></i> Bookings
        </button>
        <button 
          className={`tabs-nav-button ${activeTab === 'clients' ? 'active' : ''}`}
          onClick={() => setActiveTab('clients')}
        >
          <i className="fa-solid fa-users fa-fw"></i> Clients
        </button>
      </div>
      
      {/* --- NEW: Tab Content --- */}
      <div className="admin-section" style={{borderTop: 'none', borderRadius: '0 0 8px 8px'}}>
        {activeTab === 'quoting' && (
          <QuotingSettingsTab {...commonProps} />
        )}
        {activeTab === 'invoicing' && (
          <div className="tab-content-pane">
            <h2>Invoicing & Payments</h2>
            <p>Settings for bank details, invoice terms, and payment gateways will go here.</p>
          </div>
        )}
        {activeTab === 'bookings' && (
          <div className="tab-content-pane">
            <h2>Bookings</h2>
            <p>Settings for business hours, calendar slots, and reminders will go here.</p>
          </div>
        )}
        {activeTab === 'clients' && (
          <div className="tab-content-pane">
            <h2>Clients</h2>
            <p>Settings for the "Refer a Friend" program will go here.</p>
          </div>
        )}
      </div>
      
    </div>
  );
}

export default BusinessSettings;