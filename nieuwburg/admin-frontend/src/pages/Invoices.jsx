import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarLoader } from 'react-spinners';

function Invoices() {
  const [invoices, setInvoices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [csrfToken, setCsrfToken] = useState("");
  
  // Handle flash messages
  const location = useLocation();
  const [flashMsg, setFlashMsg] = useState(location.state?.flashMessage || null);

  useEffect(() => {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
    setCsrfToken(token || "");

    const fetchInvoices = async () => {
      try {
        const response = await fetch('/api/admin/invoices');
        if (!response.ok) throw new Error('Failed to fetch invoices');
        const data = await response.json();
        setInvoices(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchInvoices();
  }, []);

  // --- Send Email Handler ---
  const handleSend = async (invoiceId, email) => {
    if (!window.confirm(`Email this invoice to ${email}?`)) return;
    
    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: { 'X-CSRFToken': csrfToken }
      });
      const result = await response.json();
      if (response.ok) {
        alert(result.message);
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (err) {
      console.error(err);
      alert("Network error sending invoice.");
    }
  };

  // --- Copy Link Handler ---
  const handleCopyLink = (token) => {
    if (!token) {
      alert("No payment link available for this invoice.");
      return;
    }
    const url = `${window.location.origin}/invoice/pay/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setFlashMsg({ type: 'success', text: 'Payment link copied to clipboard!' });
      // Clear message after 3 seconds
      setTimeout(() => setFlashMsg(null), 3000);
    }, () => {
      alert("Failed to copy link.");
    });
  };

  const handleDelete = async (invoiceId) => {
    if (!window.confirm("Are you sure? This will permanently delete this invoice.")) return;
    
    try {
      const response = await fetch(`/admin/invoices/delete/${invoiceId}`, {
        method: 'POST',
        headers: { 'X-CSRFToken': csrfToken }
      });
      const result = await response.json();
      if (result.status === 'ok') {
        setInvoices(invoices.filter(inv => inv.id !== invoiceId));
        setFlashMsg({ type: 'success', text: result.message });
      } else {
        alert(result.message || "Failed to delete invoice.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred.");
    }
  };

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <BarLoader color="#006ac6" width="50%" />
      </div>
    );
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Invoices</h1>
        <div className="header-actions">
           <button className="cta" disabled title="Create via Quotes for now">New Invoice</button>
        </div>
      </div>

      {flashMsg && (
        <div className={`flash ${flashMsg.type}`}>
            {flashMsg.text}
        </div>
      )}

      {error && <p className="error-message">{error}</p>}

      {!isLoading && !error && invoices.length === 0 ? (
        <div className="empty-state">
          <p>No invoices generated yet.</p>
          <p style={{fontSize: '0.9rem', color: '#666'}}>Go to "Quotes" and convert an accepted quote to an invoice.</p>
          <Link to="/quotes" className="cta-outline" style={{marginTop: '10px', display: 'inline-block'}}>Go to Quotes</Link>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Date Issued</th>
                <th>Due Date</th>
                <th>Total</th>
                <th>Status</th>
                <th style={{textAlign: 'right'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td style={{fontWeight: 600, color: '#002244'}}>
                    {inv.invoice_number}
                  </td>
                  <td>
                    {inv.client_name}
                    {inv.client_id && (
                        <Link to={`/clients/${inv.client_id}`} className="table-link-icon" title="View Client">
                            <i className="fa-regular fa-user"></i>
                        </Link>
                    )}
                  </td>
                  <td>{inv.issue_date}</td>
                  <td>{inv.due_date}</td>
                  <td style={{fontWeight: 600}}>
                    R {inv.total_amount ? inv.total_amount.toFixed(2) : '0.00'}
                  </td>
                  <td>
                    <span className="status-badge" data-status={inv.status}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={{textAlign: 'right'}}>
                    {/* Copy Link Button */}
                    <button 
                        className="icon-btn" 
                        onClick={() => handleCopyLink(inv.payment_token)}
                        title="Copy Payment Link"
                        style={{marginRight: '8px', color: '#006ac6'}}
                    >
                        <i className="fa-solid fa-link"></i>
                    </button>

                    {/* Send Email Button */}
                    <button 
                        className="icon-btn" 
                        onClick={() => handleSend(inv.id, inv.client_name)}
                        title="Email Invoice"
                        style={{marginRight: '8px', color: '#10b981'}}
                    >
                        <i className="fa-solid fa-paper-plane"></i>
                    </button>

                    {/* Delete Button */}
                    <button 
                        className="icon-btn delete-btn" 
                        onClick={() => handleDelete(inv.id)}
                        title="Delete Invoice"
                    >
                        <i className="fa-solid fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Invoices;