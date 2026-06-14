import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { BarLoader } from 'react-spinners';

// --- "SMART" LINE ITEM COMPONENT ---
const LineItem = ({ item, index, onServiceSelect, onManualChange, onRemove, allServices }) => {
  const amount = (item.quantity || 0) * (item.unit_price || 0);

  const handleServiceChange = (e) => {
    const serviceId = parseInt(e.target.value, 10);
    if (serviceId) {
      const service = allServices.find(s => s.id === serviceId);
      if (service) {
        onServiceSelect(index, service);
      }
    } else {
      onServiceSelect(index, null); // User selected "Custom Item"
    }
  };

  return (
    <div className="line-item-row-smart">
      <div className="line-item-select">
        <select
          className="form-input"
          value={item.service_item_id || ""}
          onChange={handleServiceChange}
        >
          <option value="">-- Select a Service or Custom --</option>
          {allServices.map(service => (
            <option key={service.id} value={service.id}>
              {service.name}
            </option>
          ))}
        </select>
      </div>

      <div className="line-item-details">
        <textarea
          placeholder="Description"
          value={item.description || ''}
          onChange={(e) => onManualChange(index, 'description', e.target.value)}
          className="form-input"
          rows={3}
        />
        <div className="line-item-inputs">
          <input
            type="number" placeholder="Qty" value={item.quantity || 1}
            onChange={(e) => onManualChange(index, 'quantity', e.target.value)}
            className="form-input"
          />
          <input
            type="number" placeholder="Unit Price" value={item.unit_price || 0}
            onChange={(e) => onManualChange(index, 'unit_price', e.target.value)}
            className="form-input"
          />
          <input
            type="text" readOnly value={`R ${isNaN(amount) ? '0.00' : amount.toFixed(2)}`}
            className="form-input"
          />
          <button type="button" onClick={() => onRemove(index)} className="cta-danger-outline">X</button>
        </div>
      </div>
    </div>
  );
};


// --- MAIN EDIT QUOTE PAGE ---
function EditQuote() {
  const navigate = useNavigate();
  const { quoteId } = useParams();

  // Quote-specific data
  const [clientId, setClientId] = useState(null);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestAddress, setGuestAddress] = useState('');
  const [lineItems, setLineItems] = useState([
    { service_item_id: null, description: '', quantity: 1, unit_price: 0 }
  ]);
  const [discount, setDiscount] = useState(0);

  // Business info state
  const [isLocked, setIsLocked] = useState(true); // Locked by default
  const [termsAndConditions, setTermsAndConditions] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  
  // Loaded data state
  const [allServices, setAllServices] = useState([]);
  const [allClauses, setAllClauses] = useState([]);
  const [businessSettings, setBusinessSettings] = useState(null); // Defaults
  
  // System state
  const [csrfToken, setCsrfToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false); // <-- Use this for submit button
  const [error, setError] = useState(null);

  // --- 1. Data Fetching ---
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
      setCsrfToken(token || "");

      try {
        // --- Fetch all 4 data sources in parallel ---
        const [quoteRes, servicesRes, settingsRes, clausesRes] = await Promise.all([
          fetch(`/api/admin/quotes/formal/${quoteId}`),
          fetch('/api/admin/all-services'),
          fetch('/api/admin/business-settings'),
          fetch('/api/admin/service-clauses')
        ]);

        if (!quoteRes.ok) throw new Error('Failed to load quote');
        if (!servicesRes.ok) throw new Error('Failed to load services list');
        if (!settingsRes.ok) throw new Error('Failed to load business settings');
        if (!clausesRes.ok) throw new Error('Failed to load T&C clauses');
        
        const quoteData = await quoteRes.json();
        const servicesData = await servicesRes.json();
        const settingsData = await settingsRes.json();
        const clausesData = await clausesRes.json();
        
        if (quoteData.quote.status !== 'Draft') {
          setError(`This quote is "${quoteData.quote.status}" and can no longer be edited.`);
          setIsLoading(false);
          return;
        }

        // --- Populate state ---
        setAllServices(servicesData);
        setAllClauses(clausesData);
        setBusinessSettings(settingsData);
        
        // Populate client info
        setClientId(quoteData.client.user_id || null);
        setGuestName(quoteData.client.name || '');
        setGuestEmail(quoteData.client.email || '');
        setGuestPhone(quoteData.client.phone || '');
        setGuestAddress(quoteData.client.address || '');
        
        // Populate line items
        setLineItems(quoteData.quote.line_items && quoteData.quote.line_items.length > 0 ? quoteData.quote.line_items : [{ service_item_id: null, description: '', quantity: 1, unit_price: 0 }]);
        setDiscount(quoteData.quote.discount || 0);
        
        // --- Populate business info (Use saved quote data first, fallback to global settings) ---
        setBusinessAddress(quoteData.quote.business_address || settingsData.business_address);
        setRegistrationNumber(quoteData.quote.registration_number || settingsData.registration_number);
        
        // If T&Cs were saved on the quote, use them.
        // Otherwise, they will be auto-assembled by the next useEffect.
        if (quoteData.quote.terms_and_conditions) {
          setTermsAndConditions(quoteData.quote.terms_and_conditions);
        }

      } catch (err) {
        console.error("Error fetching data:", err);
        setError(`Failed to load page: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [quoteId]);

  // --- 2. "Smart T&C" Auto-Assembly Logic ---
  useEffect(() => {
    // Only auto-assemble if the section is locked AND all data is loaded
    if (isLocked && businessSettings && allServices && allServices.length > 0 && allClauses && allClauses.length > 0) {
      
      // 1. Get default terms
      let newTerms = businessSettings.default_terms || "";
      
      // 2. Find all unique service IDs from line items
      const serviceIdsInQuote = new Set(
        lineItems
          .map(item => item.service_item_id)
          .filter(id => id != null) // Filter out null/custom items
      );
      
      // 3. Find all unique clause IDs linked to those services
      const clauseIdsToInclude = new Set();
      allServices.forEach(service => {
        if (serviceIdsInQuote.has(service.id)) {
          service.linked_clause_ids.forEach(id => clauseIdsToInclude.add(id));
        }
      });
      
      // 4. Build the T&C string
      const clausesText = allClauses
        .filter(clause => clauseIdsToInclude.has(clause.id))
        .map(clause => clause.text)
        .join("\n\n"); // Join clauses with a double line break

      if (clausesText) {
        newTerms += `\n\n--- Additional Terms ---\n${clausesText}`;
      }
      
      setTermsAndConditions(newTerms);
    }
    // This dependency array is key: it re-runs this logic
    // every time the line items change *while the panel is locked*.
  }, [isLocked, lineItems, allServices, allClauses, businessSettings]);


  // --- 3. Line Item Handlers ---
  const handleServiceSelect = (index, service) => {
    const updatedItems = [...lineItems];
    if (service) {
      // Auto-populate from selected service
      updatedItems[index] = {
        ...updatedItems[index],
        service_item_id: service.id,
        description: service.default_description,
        unit_price: service.default_price,
        quantity: 1,
      };
    } else {
      // User selected "Custom", so clear the link
      updatedItems[index] = {
        ...updatedItems[index],
        description: '', // Clear description
        unit_price: 0, // Reset price
        service_item_id: null,
      };
    }
    setLineItems(updatedItems);
  };

  const handleManualChange = (index, field, value) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    setLineItems(updatedItems);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { service_item_id: null, description: '', quantity: 1, unit_price: 0 }]);
  };

  const removeLineItem = (index) => {
    if (lineItems.length > 1) {
      setLineItems(lineItems.filter((_, i) => i !== index));
    } else {
      // If it's the last one, just reset it
      setLineItems([{ service_item_id: null, description: '', quantity: 1, unit_price: 0 }]);
    }
  };

  // --- 4. Calculate Totals ---
  const subtotal = lineItems.reduce((acc, item) => {
    return acc + (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0);
  }, 0);
  const total = subtotal - (parseFloat(discount) || 0);

  // --- 5. Form Submission ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true); // Use isSaving, not isLoading
    setError(null);

    const quoteData = {
      client_id: clientId,
      guest_name: guestName,
      email: guestEmail,
      phone_number: guestPhone,
      address: guestAddress,
      
      line_items: lineItems.map(item => ({
        ...item,
        service_item_id: item.service_item_id || null, // Ensure null is sent
        quantity: parseFloat(item.quantity) || 0,
        unit_price: parseFloat(item.unit_price) || 0,
        amount: (parseFloat(item.quantity) || 0) * (parseFloat(item.unit_price) || 0)
      })),
      
      subtotal: subtotal,
      discount: parseFloat(discount) || 0,
      total: total,
      
      // Send the (potentially overridden) business info
      terms_and_conditions: termsAndConditions,
      business_address: businessAddress,
      registration_number: registrationNumber
    };

    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
        body: JSON.stringify(quoteData)
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Failed to update quote');
      }
      navigate(`/quotes/formal/${quoteId}`, { 
        state: { flashMessage: { type: 'success', text: result.message } } 
      });
    } catch (err) {
      console.error("Error updating quote:", err);
      setError(err.message);
      setIsSaving(false);
    }
  };
  
  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <BarLoader color="#006ac6" width="50%" />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="admin-header">
          <h1>Edit Quote</h1>
           <Link to={`/quotes/formal/${quoteId}`} className="cta-outline">Back to Quote</Link>
        </div>
        <div className="flash error">{error}</div>
      </div>
    );
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Edit Quote</h1>
        <p>You are editing a quote currently in "Draft" status.</p>
      </div>

      <form onSubmit={handleSubmit} className="admin-section">
        
        {/* --- Client Info Section --- */}
        <div className="admin-section" style={{background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px'}}>
          <h2>Client Information</h2>
          <div className="form-grid">
             <div className="form-group">
              <label htmlFor="guestName">Client Name</label>
              <input
                id="guestName" type="text" className="form-input"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="guestEmail">Client Email</label>
              <input
                id="guestEmail" type="email" className="form-input"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="guestPhone">Client Phone</label>
              <input
                id="guestPhone" type="tel" className="form-input"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="guestAddress">Client Address</label>
              <textarea
                id="guestAddress" className="form-input"
                value={guestAddress}
                onChange={(e) => setGuestAddress(e.target.value)}
                rows={3}
              ></textarea>
            </div>
          </div>
        </div>

        {/* --- "Smart" Line Items Section --- */}
        <div className="admin-section" style={{marginTop: '20px'}}>
          <h2>Line Items</h2>
          {lineItems.map((item, index) => (
            <LineItem
              key={item.id || index} // Use item.id if it exists, fallback to index
              item={item}
              index={index}
              allServices={allServices}
              onServiceSelect={handleServiceSelect}
              onManualChange={handleManualChange}
              onRemove={removeLineItem}
            />
          ))}
          {/* === THIS IS THE SYNTAX FIX === */}
          <button type="button" onClick={addLineItem} className="cta-outline" style={{marginTop: '10px'}}>
            + Add Line Item
          </button>
        </div>
        
        {/* --- Totals Section --- */}
        <div className="quote-totals" style={{width: '40%', marginLeft: 'auto', marginTop: '20px'}}>
           <div className="totals-row">
            <span>Subtotal</span>
            <span>R {subtotal.toFixed(2)}</span>
          </div>
          <div className="totals-row">
            <label htmlFor="discount" style={{fontWeight: 600}}>Discount</label>
            <div style={{display: 'flex', alignItems: 'center'}}>
              <span style={{marginRight: '5px'}}>R</span>
              <input
                id="discount" type="number" step="0.01" className="form-input"
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                style={{width: '100px', textAlign: 'right', padding: '5px 8px'}}
              />
            </div>
          </div>
          <div className="totals-row grand-total">
            <span>TOTAL</span>
            <span>R {total.toFixed(2)}</span>
          </div>
        </div>

        {/* --- "Smart" Business Info Section --- */}
        <div className={`admin-section locked-settings-section ${isLocked ? 'is-locked' : 'is-unlocked'}`}>
          <div className="locked-settings-header">
            <h2>Business & Terms</h2>
            <button type="button" onClick={() => setIsLocked(!isLocked)} className="cta-outline-small">
              {isLocked ? 'Unlock to Edit' : 'Lock Fields'}
            </button>
          </div>
          <p>This info is auto-filled from your settings. Unlock to make quote-specific changes.</p>
          
          <div className="form-group">
            <label htmlFor="businessAddress">Business Address</label>
            <input
              id="businessAddress" type="text" className="form-input"
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              readOnly={isLocked}
            />
          </div>
          <div className="form-group">
            <label htmlFor="registrationNumber">Registration No.</label>
            <input
              id="registrationNumber" type="text" className="form-input"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              readOnly={isLocked}
            />
          </div>
          <div className="form-group">
            <label htmlFor="termsAndConditions">Terms & Conditions</label>
            <textarea
              id="termsAndConditions" className="form-input"
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              rows={10}
              readOnly={isLocked}
            />
          </div>
        </div>

        {/* --- Submission --- */}
        <div style={{borderTop: '1px solid #e5e7eb', marginTop: '30px', paddingTop: '20px', textAlign: 'right'}}>
          <button type="button" onClick={() => navigate(`/quotes/formal/${quoteId}`)} className="cta-outline">
            Cancel
          </button>
          {/* This button now checks 'isSaving' */}
          <button type="submit" className="cta" disabled={isSaving} style={{marginLeft: '10px'}}>
            {isSaving ? <BarLoader color="#fff" height={20} width={100} /> : 'Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditQuote;