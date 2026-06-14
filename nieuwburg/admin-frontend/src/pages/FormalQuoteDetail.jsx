import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { BarLoader } from 'react-spinners';

function FormalQuoteDetail() {
  const { quoteId } = useParams();
  const navigate = useNavigate();
  const [quoteData, setQuoteData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [csrfToken, setCsrfToken] = useState("");
  
  // Action States
  const [isSending, setIsSending] = useState(false);
  const [isConverting, setIsConverting] = useState(false);
  const [flashMsg, setFlashMsg] = useState(null);

  useEffect(() => {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
    setCsrfToken(token || "");

    const fetchQuote = async () => {
      try {
        const response = await fetch(`/api/admin/quotes/formal/${quoteId}`);
        if (!response.ok) throw new Error('Failed to fetch quote details');
        const data = await response.json();
        setQuoteData(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchQuote();
  }, [quoteId]);

  // --- HANDLER: Send Quote ---
  const handleSendQuote = async () => {
    if (!window.confirm(`Send Quote ${quoteData.quote.quote_number} to ${quoteData.client.email}?`)) return;
    
    setIsSending(true);
    try {
      const response = await fetch(`/api/admin/quotes/${quoteData.quote.id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        }
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      setFlashMsg({ type: 'success', text: result.message });
      // Update local status
      setQuoteData(prev => ({ ...prev, quote: { ...prev.quote, status: 'Sent' } }));
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSending(false);
    }
  };

  // --- HANDLER: Convert to Invoice ---
  const handleConvertToInvoice = async () => {
    if (!window.confirm("This will generate a new Invoice from this Quote. Continue?")) return;

    setIsConverting(true);
    try {
      const response = await fetch(`/api/admin/quotes/${quoteData.quote.id}/convert-to-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRFToken': csrfToken
        }
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.message);

      // Success! Redirect to the Invoices list
      navigate('/invoices', { 
        state: { flashMessage: { type: 'success', text: result.message } } 
      });

    } catch (err) {
      alert(`Error: ${err.message}`);
      setIsConverting(false);
    }
  };

  // --- HANDLER: Delete Quote ---
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this quote? This cannot be undone.")) return;
    try {
        const response = await fetch(`/api/admin/quotes/${quoteData.quote.id}?type=quote`, {
            method: 'DELETE',
            headers: { 'X-CSRFToken': csrfToken }
        });
        if(response.ok) {
            navigate('/quotes');
        } else {
            alert("Failed to delete quote.");
        }
    } catch(e) {
        console.error(e);
        alert("An error occurred.");
    }
  };


  if (isLoading) return <div className="loading-container"><BarLoader color="#006ac6" /></div>;
  if (error) return <div className="flash error">{error}</div>;
  if (!quoteData) return <div>Quote not found</div>;

  const { client, quote, line_items } = quoteData;

  return (
    <div>
      <div className="admin-header">
        <div>
            <h1 style={{marginBottom: '5px'}}>Quote {quote.quote_number}</h1>
            <div className="status-badge" data-status={quote.status}>{quote.status}</div>
        </div>
        <div className="header-actions">
            <Link to="/quotes" className="cta-outline">Back to List</Link>
            
            {/* EDIT BUTTON: Only if Draft */}
            {quote.status === 'Draft' && (
                <Link to={`/quotes/edit/${quote.id}`} className="cta-outline">Edit Quote</Link>
            )}
            
            {/* DELETE BUTTON */}
             <button onClick={handleDelete} className="cta-danger-outline">Delete</button>

            {/* SEND BUTTON: If not Accepted/Rejected */}
            {['Draft', 'Sent'].includes(quote.status) && (
                <button onClick={handleSendQuote} disabled={isSending} className="cta">
                    {isSending ? 'Sending...' : 'Email Quote'}
                </button>
            )}

            {/* CONVERT BUTTON: The New Feature */}
            <button 
                onClick={handleConvertToInvoice} 
                disabled={isConverting} 
                className="cta"
                style={{backgroundColor: '#10b981', borderColor: '#10b981'}} // Green color
            >
                {isConverting ? 'Converting...' : 'Convert to Invoice'}
            </button>
        </div>
      </div>

      {flashMsg && (
        <div className={`flash ${flashMsg.type}`} style={{marginBottom: '20px'}}>
            {flashMsg.text}
        </div>
      )}

      <div className="quote-preview-container" style={{backgroundColor: '#fff', padding: '40px', borderRadius: '8px', border: '1px solid #e5e7eb', maxWidth: '800px', margin: '0 auto'}}>
        
        {/* Header Section */}
        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '40px'}}>
            <div>
                <h2 style={{margin: 0, color: '#002244'}}>QUOTATION</h2>
                <p style={{color: '#6b7280', margin: '5px 0'}}>#{quote.quote_number}</p>
            </div>
            <div style={{textAlign: 'right'}}>
                <h3 style={{fontSize: '1.1rem', margin: 0}}>{quote.business_name || 'Nieuwburg Blitz'}</h3>
                <p style={{fontSize: '0.9rem', color: '#6b7280', whiteSpace: 'pre-line'}}>
                    {quote.business_address}
                </p>
            </div>
        </div>

        {/* Client & Dates */}
        <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '40px', paddingBottom: '20px', borderBottom: '1px solid #f3f4f6'}}>
            <div>
                <span style={{display: 'block', fontSize: '0.85rem', textTransform: 'uppercase', color: '#9ca3af', fontWeight: 600}}>Bill To</span>
                <strong style={{fontSize: '1.1rem'}}>{client.name}</strong>
                <p style={{margin: '5px 0', color: '#4b5563'}}>{client.email}</p>
                <p style={{margin: '0', color: '#4b5563'}}>{client.phone}</p>
            </div>
            <div style={{textAlign: 'right'}}>
                 <div style={{marginBottom: '10px'}}>
                    <span style={{display: 'block', fontSize: '0.85rem', color: '#9ca3af'}}>Date</span>
                    <strong>{quote.quote_date}</strong>
                 </div>
                 <div>
                    <span style={{display: 'block', fontSize: '0.85rem', color: '#9ca3af'}}>Expiry</span>
                    <strong>{quote.expiry_date}</strong>
                 </div>
            </div>
        </div>

        {/* Line Items */}
        <table style={{width: '100%', borderCollapse: 'collapse', marginBottom: '30px'}}>
            <thead>
                <tr style={{borderBottom: '2px solid #e5e7eb'}}>
                    <th style={{textAlign: 'left', padding: '10px 0', color: '#4b5563'}}>Description</th>
                    <th style={{textAlign: 'center', padding: '10px 0', color: '#4b5563', width: '80px'}}>Qty</th>
                    <th style={{textAlign: 'right', padding: '10px 0', color: '#4b5563', width: '120px'}}>Price</th>
                    <th style={{textAlign: 'right', padding: '10px 0', color: '#4b5563', width: '120px'}}>Amount</th>
                </tr>
            </thead>
            <tbody>
                {line_items.map(item => (
                    <tr key={item.id} style={{borderBottom: '1px solid #f3f4f6'}}>
                        <td style={{padding: '15px 0'}}>
                            <div style={{fontWeight: 500}}>{item.description}</div>
                        </td>
                        <td style={{textAlign: 'center', padding: '15px 0'}}>{item.quantity}</td>
                        <td style={{textAlign: 'right', padding: '15px 0'}}>R {item.unit_price.toFixed(2)}</td>
                        <td style={{textAlign: 'right', padding: '15px 0'}}>R {item.amount.toFixed(2)}</td>
                    </tr>
                ))}
            </tbody>
        </table>

        {/* Totals */}
        <div style={{display: 'flex', justifyContent: 'flex-end'}}>
            <div style={{width: '250px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                    <span style={{color: '#6b7280'}}>Subtotal</span>
                    <span>R {quote.subtotal.toFixed(2)}</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', marginBottom: '10px'}}>
                    <span style={{color: '#6b7280'}}>Discount</span>
                    <span>- R {quote.discount.toFixed(2)}</span>
                </div>
                <div style={{display: 'flex', justifyContent: 'space-between', borderTop: '2px solid #e5e7eb', paddingTop: '10px', fontWeight: 700, fontSize: '1.1rem'}}>
                    <span>Total</span>
                    <span>R {quote.total.toFixed(2)}</span>
                </div>
            </div>
        </div>
        
        {/* T&Cs */}
        {quote.terms_and_conditions && (
            <div style={{marginTop: '40px', borderTop: '1px solid #f3f4f6', paddingTop: '20px'}}>
                <h4 style={{fontSize: '0.9rem', textTransform: 'uppercase', color: '#9ca3af'}}>Terms & Conditions</h4>
                <div style={{fontSize: '0.85rem', color: '#6b7280', whiteSpace: 'pre-line', lineHeight: 1.5}}>
                    {quote.terms_and_conditions}
                </div>
            </div>
        )}

      </div>
    </div>
  );
}

export default FormalQuoteDetail;