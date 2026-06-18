import React, { useState, useEffect, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom'; // Import Link & useLocation
import ActionsDropdown from '../components/ActionsDropdown';
import { BarLoader } from 'react-spinners'; // Import a loader for consistency

function Quotes() {
  const [csrfToken, setCsrfToken] = useState("");
  const [quotes, setQuotes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // --- ADDITIONS ---
  const location = useLocation();
  const [flashMessage, setFlashMessage] = useState(location.state?.flashMessage || null);

  // Add a useEffect to handle clearing the flash message
  useEffect(() => {
    if (location.state?.flashMessage) {
      window.history.replaceState({}, document.title); // Clear navigation state
    }
    if (flashMessage) {
      const timer = setTimeout(() => setFlashMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [flashMessage, location.state]);
  
  const fetchQuotes = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/quotes');
      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Permission denied fetching quotes.');
        }
        throw new Error(`HTTP error fetching quotes! status: ${response.status}`);
      }
      const data = await response.json();
      setQuotes(data);
    } catch (err) {
      console.error('Error fetching quotes:', err);
      setError(`Error loading quotes: ${err.message}`);
      setQuotes([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
    setCsrfToken(token || "");
    fetchQuotes();
  }, [fetchQuotes]); // Run once on mount

  // Helper function to format price
  const formatPrice = (price) => {
     if (price === null || price === undefined) return 'N/A';
     const num = parseFloat(price);
     return isNaN(num) ? 'N/A' : `R${num.toFixed(2)}`;
  };

  const handleSendQuote = async (quoteId) => {
    if (!csrfToken) {
      alert("CSRF token missing. Please refresh the page.");
      return;
    }

    if (!confirm("Are you sure you want to send this quote to the client?")) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}/send`, {
        method: 'POST',
        headers: {
          'X-CSRFToken': csrfToken,
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "Failed to send quote");
      }

      // *** BUG FIX: Change setQuoteRequests to setQuotes ***
      setQuotes(prevQuotes => 
        prevQuotes.map(q => 
          q.id === quoteId ? { ...q, status: result.new_status } : q
        )
      );

      setFlashMessage({ type: 'success', text: result.message }); // Show success message

    } catch (err) {
      console.error("Error sending quote:", err);
      setFlashMessage({ type: 'error', text: err.message }); // Show error message
    }
  };

  const handleDeleteQuote = async (quoteId, quoteType, listId) => { // <-- Added listId here
    if (!csrfToken) {
      setFlashMessage({ type: 'error', text: "CSRF token missing. Please refresh." });
      return;
    }
    
    if (!confirm("Are you sure you want to permanently delete this item? This action cannot be undone.")) {
      return;
    }
    
    try {
      const response = await fetch(`/api/admin/quotes/${quoteId}?type=${quoteType}`, {
        method: 'DELETE', 
        headers: {
          'X-CSRFToken': csrfToken,
          'Content-Type': 'application/json'
        }
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || "Failed to delete item");
      }

      await fetchQuotes();
      
      setFlashMessage({ type: 'success', text: result.message });

    } catch (err) {
      console.error("Error deleting quote:", err);
      setFlashMessage({ type: 'error', text: err.message });
    }
  };

  return (
    <div>
      <div className="admin-header">
        <h1>Quote Requests</h1>
        <p>View and manage all quote requests received.</p>
        <Link to="/quotes/new" className="cta">
          Create New Quote
        </Link>
      </div>

      {/* --- ADDED: Flash Message Display --- */}
      {flashMessage && (
        <div className={`flash ${flashMessage.type}`} style={{ marginBottom: '20px' }}>
          {flashMessage.text}
        </div>
      )}

      {error && (
        <div className="flash error" style={{ marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div className="admin-section">
        <h2>All Quotes</h2>
        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}>
            <BarLoader color="#4A90E2" width="50%" />
          </div>
        ) : quotes.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                {/* These headers match your provided file */}
                <th>Requested On</th> 
                <th>Client</th>
                <th>Service</th>
                <th>Frequency</th>
                <th>Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.list_id}> {/* <-- Use list_id for unique key */}
                  <td data-label="Requested On">{quote.request_date}</td>
                  <td data-label="Client">
                    {quote.user_id ? (
                      <Link to={`/clients/${quote.user_id}`}>
                        <strong>{quote.client_name}</strong>
                      </Link>
                    ) : (
                      <strong>{quote.client_name}</strong>
                    )}
                    <br />
                    <small>{quote.client_phone}</small>
                  </td>
                  <td data-label="Service">
                    {quote.service} {quote.property_type ? `(${quote.property_type})` : ''}
                  </td>
                   <td data-label="Frequency">{quote.frequency}</td>
                  <td data-label="Price">{formatPrice(quote.total_price)}</td>
                  <td data-label="Status">
                    <span className={`booking-status status-${quote.status?.toLowerCase() || 'unknown'}`}>
                       {quote.status}
                    </span>
                  </td>
                  <td data-label="Actions" className="actions-cell">
                    {/* *** THIS IS THE FIX: Pass quote.type to the handlers *** */}
                    <ActionsDropdown 
                      quote={quote} 
                      onSend={() => handleSendQuote(quote.id, quote.type)}
                      onDelete={() => handleDeleteQuote(quote.id, quote.type, quote.list_id)} 
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No quote requests found.</p>
        )}
      </div>
    </div>
  );
}

export default Quotes;