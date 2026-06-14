// Add 'Link' to your imports
import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom'; // Add Link and useNavigate
import { BarLoader } from 'react-spinners';

function QuoteDetail() {
  const { quoteId } = useParams();
  const [quoteData, setQuoteData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // --- ADD THIS ---
  const navigate = useNavigate();

  useEffect(() => {
    const fetchQuoteDetail = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/quotes/${quoteId}`); // This is the lead/request endpoint
        if (!response.ok) {
          if (response.status === 404) throw new Error('Quote request not found.');
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setQuoteData(data);
      } catch (err) {
        console.error('Error fetching quote detail:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuoteDetail();
  }, [quoteId]);
  
  // --- ADD THIS HANDLER ---
  // This function will navigate to the create page and pass the data
  const handleConvertToQuote = () => {
    if (!quoteData) return;

    // We pass the lead data via the 'state' prop
    // This is cleaner than a long URL
    navigate('/quotes/new', { 
      state: { fromRequest: quoteData } 
    });
  };

  if (isLoading) {
    return <div className="loading-indicator">Loading quote request...</div>;
  }

  if (error) {
    // ... (error rendering, no change needed)
  }

  if (!quoteData) {
    return <p>No data found.</p>;
  }

  // De-structure the data
  const { client, request } = quoteData;

  return (
    <div>
      <div className="admin-header">
        <h1>Quote Request: {request.subject || client.name}</h1>
        <div className="admin-header-actions">
          {/* --- THIS IS THE NEW BUTTON --- */}
          <button onClick={handleConvertToQuote} className="cta">
            Create Formal Quote
          </button>
          <Link to="/quotes" className="cta-outline" style={{marginLeft: '10px'}}>
            Back to Quotes
          </Link>
        </div>
      </div>

      <div className="admin-section">
        <div className="quote-details-grid">
          <div className="detail-card">
            <h3>Client Details</h3>
            <p><strong>Name:</strong><br />
              {client.user_id ? (
                <Link to={`/clients/${client.user_id}`}>{client.name}</Link>
              ) : (
                client.name
              )}
            </p>
            <p><strong>Email:</strong><br /> {client.email}</p>
            <p><strong>Phone:</strong><br /> {client.phone}</p>
            <p><strong>Address:</strong><br /> {client.address}</p>
          </div>
          <div className="detail-card">
            <h3>Request Details</h3>
            <p><strong>Submitted On:</strong><br /> {request.submitted_on}</p>
            <p><strong>Status:</strong><br />
              <span className={`status-badge status-${request.status.toLowerCase()}`}>{request.status}</span>
            </p>
            <p><strong>Subject:</strong><br /> {request.subject}</p>
          </div>
        </div>
      </div>

      <div className="admin-section">
        <h2>Full Description</h2>
        <div className="detail-card">
          <p style={{whiteSpace: 'pre-wrap', lineHeight: '1.6'}}>
            {request.full_description}
          </p>
        </div>
      </div>
    </div>
  );
}

export default QuoteDetail;