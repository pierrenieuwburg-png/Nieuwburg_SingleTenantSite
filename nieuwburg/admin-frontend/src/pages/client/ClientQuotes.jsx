import React, { useState, useEffect } from 'react';
import { getMyQuotes, downloadQuotePdf, respondToQuote, deleteQuoteRequest } from '../../services/clientApi';
import { FaFileInvoice, FaCheck, FaTimes, FaDownload, FaTrash, FaEye, FaHistory, FaSyncAlt } from 'react-icons/fa';
import { BarLoader } from 'react-spinners';
import './ClientHome.css';

const ClientQuotes = () => {
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null);

    // Modal States
    const [viewPdfUrl, setViewPdfUrl] = useState(null);
    const [acceptingQuote, setAcceptingQuote] = useState(null);
    const [finalNotes, setFinalNotes] = useState('');

    const loadData = async (isBackground = false) => {
        try {
            const data = await getMyQuotes();
            setQuotes(data);
        } catch (err) {
            console.error(err);
        } finally {
            if (!isBackground) setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
        const interval = setInterval(() => loadData(true), 10000); 
        return () => clearInterval(interval);
    }, []);

    // --- Action Handlers ---
    const handleDeleteRequest = async (reqId) => {
        if(!window.confirm('Are you sure you want to withdraw this request? This cannot be undone.')) return;
        setActionLoading(`del-${reqId}`);
        try {
            await deleteQuoteRequest(reqId);
            await loadData();
        } catch (e) {
            alert(e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleViewInline = async (q) => {
        setActionLoading(`view-${q.id}`);
        try {
            const response = await fetch(`/client/api/quotes/${q.id}/download`, {
                headers: { 
                    'Accept': 'application/pdf',
                    'X-CSRFToken': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''
                }
            });
            if (!response.ok) throw new Error("Failed to load PDF");
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            setViewPdfUrl(url);
        } catch (e) {
            alert("Could not load document for viewing.");
        } finally {
            setActionLoading(null);
        }
    };

    const closePdfViewer = () => {
        if (viewPdfUrl) URL.revokeObjectURL(viewPdfUrl);
        setViewPdfUrl(null);
    };

    const handleDownload = async (q) => {
        try {
            await downloadQuotePdf(q.id, q.display_id);
        } catch (e) {
            alert("Could not download PDF");
        }
    };

    const handleReject = async (q) => {
        if(!window.confirm(`Are you sure you want to reject this quote?`)) return;
        setActionLoading(q.id);
        try {
            await respondToQuote(q.id, 'reject');
            await loadData();
        } catch (e) {
            alert(e.message);
        } finally {
            setActionLoading(null);
        }
    };

    const handleFinalizeAcceptance = async (e) => {
        e.preventDefault();
        setActionLoading(acceptingQuote.id);
        try {
            const response = await respondToQuote(acceptingQuote.id, 'accept', { notes: finalNotes });
            setAcceptingQuote(null);
            setFinalNotes('');
            await loadData();

            if (response.amount_to_pay > 0) {
                const paymentType = response.is_deposit ? "Deposit" : "Full Payment";
                let handler = window.PaystackPop.setup({
                    key: 'YOUR_PAYSTACK_PUBLIC_KEY', // Update in production
                    email: response.email,
                    amount: response.amount_to_pay * 100, 
                    currency: 'ZAR',
                    ref: `QUOTE_${response.quote_id}_${Math.floor((Math.random() * 1000000000) + 1)}`, 
                    metadata: {
                        custom_fields: [{ display_name: "Payment For", variable_name: "payment_for", value: `${paymentType} - Quote ${response.quote_number}` }]
                    },
                    callback: function(paymentResponse) {
                        alert(`Payment complete! Reference: ${paymentResponse.reference}`);
                        loadData(); 
                    },
                    onClose: function() {
                        alert('Transaction was not completed, window closed.');
                    }
                });
                handler.openIframe();
            }
        } catch (err) {
            alert(err.message);
            setActionLoading(null);
        } 
    };

    if (loading) return <div className="loading-state"><BarLoader color="#006ac6" /></div>;

    // --- 3-TIER DATA SORTING ---
    const activeQuotes = quotes.filter(q => q.type === 'formal' && ['Pending', 'Sent', 'Viewed'].includes(q.status));
    const activeRequests = quotes.filter(q => q.type === 'request' && q.status === 'Pending');
    const history = quotes.filter(q => 
        (q.type === 'request' && ['Confirmed', 'Closed'].includes(q.status)) ||
        (q.type === 'formal' && ['Accepted', 'Rejected', 'Invoiced'].includes(q.status))
    );

    return (
        <div className="client-page-container" style={{ padding: '2rem' }}>
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <h1>My Quotes & Requests</h1>
                <p className="text-muted">Manage your outbound requests and inbound formal quotes.</p>
            </div>

            {quotes.length === 0 && (
                <div className="empty-state">
                    <FaFileInvoice size={48} color="#cbd5e1" />
                    <p>No active quotes or requests.</p>
                </div>
            )}

            {/* --- TIER 1: ACTIVE QUOTES --- */}
            {activeQuotes.length > 0 && (
                <div style={{ marginBottom: '3rem' }}>
                    <h2 style={{ fontSize: '1.25rem', color: '#1f2937', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
                        Action Required: Quotes Received
                    </h2>
                    <div className="invoice-list-container">
                        {activeQuotes.map(item => (
                            <div key={`formal-${item.id}`} className="invoice-card" style={{
                                backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem', 
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', display: 'flex', justifyContent: 'space-between', 
                                alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderLeft: '4px solid #0ea5e9'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{item.display_id}</span>
                                        <span className={`status-pill ${item.status.toLowerCase().replace(' ', '-')}`}>{item.status}</span>
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '6px' }}>
                                        {item.service_title} • {item.date}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <strong style={{ fontSize: '1.2rem', marginRight: '10px' }}>R {item.amount.toFixed(2)}</strong>
                                    <button onClick={() => handleViewInline(item)} disabled={actionLoading === `view-${item.id}`} className="btn-icon" title="View Document" style={{
                                        background: '#f1f5f9', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', color: '#334155'
                                    }}>
                                        {actionLoading === `view-${item.id}` ? <BarLoader color="#334155" width={16} /> : <FaEye />}
                                    </button>
                                    <button onClick={() => setAcceptingQuote(item)} disabled={actionLoading === item.id}
                                        style={{ background: '#dcfce7', color: '#166534', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <FaCheck /> Accept
                                    </button>
                                    <button onClick={() => handleReject(item)} disabled={actionLoading === item.id}
                                        style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <FaTimes /> Reject
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- TIER 2: OUTBOUND REQUESTS --- */}
            {activeRequests.length > 0 && (
                <div style={{ marginBottom: '3rem' }}>
                    <h2 style={{ fontSize: '1.25rem', color: '#1f2937', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '1.5rem' }}>
                        Pending Requests
                    </h2>
                    <div className="invoice-list-container">
                        {activeRequests.map(item => (
                            <div key={`req-${item.id}`} className="invoice-card" style={{
                                backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px', marginBottom: '1rem', 
                                boxShadow: '0 2px 4px rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', 
                                alignItems: 'center', flexWrap: 'wrap', gap: '1rem', borderLeft: '4px solid #94a3b8'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{item.display_id}</span>
                                        <span className={`status-pill ${item.status.toLowerCase().replace(' ', '-')}`}>{item.status}</span>
                                    </div>
                                    <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '6px' }}>
                                        {item.service_title} • {item.date}
                                    </div>
                                    {item.description && (
                                         <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '4px', fontStyle: 'italic' }}>
                                            "{item.description.length > 80 ? item.description.substring(0, 80) + '...' : item.description}"
                                         </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <button onClick={() => handleDeleteRequest(item.id)} disabled={actionLoading === `del-${item.id}`}
                                        style={{ background: '#fee2e2', color: '#991b1b', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', gap: '6px', alignItems: 'center' }}>
                                        <FaTrash /> Withdraw
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- TIER 3: HISTORY --- */}
            {history.length > 0 && (
                <div>
                    <h2 style={{ fontSize: '1.25rem', color: '#1f2937', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <FaHistory color="#94a3b8" /> History
                    </h2>
                    <div className="invoice-list-container" style={{ opacity: 0.8 }}>
                        {history.map(item => (
                            <div key={`hist-${item.type}-${item.id}`} className="invoice-card" style={{
                                backgroundColor: '#f8fafc', padding: '1.25rem', borderRadius: '12px', marginBottom: '1rem', 
                                border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', 
                                alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
                            }}>
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <span style={{ fontWeight: 'bold', fontSize: '1rem', color: '#64748b' }}>{item.display_id}</span>
                                        <span className={`status-pill ${item.status.toLowerCase().replace(' ', '-')}`}>{item.status}</span>
                                    </div>
                                    <div style={{ color: '#94a3b8', fontSize: '0.85rem', marginTop: '6px' }}>
                                        {item.service_title} • {item.date}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    {/* Future placeholder for rebooking feature */}
                                    <button disabled style={{ background: 'white', color: '#94a3b8', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', fontWeight: 600, display: 'flex', gap: '6px', alignItems: 'center', cursor: 'not-allowed' }}>
                                        <FaSyncAlt /> Copy to New
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ... Modal Overlays (PDF Viewer & Acceptance) remain exactly the same ... */}
            {viewPdfUrl && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '2rem' }}>
                    <div style={{ background: 'white', borderRadius: '12px', width: '100%', maxWidth: '900px', height: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
                            <h3 style={{ margin: 0, color: '#0f172a' }}>Document Viewer</h3>
                            <button onClick={closePdfViewer} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.2rem', color: '#64748b' }}><FaTimes /></button>
                        </div>
                        <iframe src={viewPdfUrl} style={{ width: '100%', flex: 1, border: 'none' }} title="Document Viewer" />
                    </div>
                </div>
            )}

            {acceptingQuote && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: 'white', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '500px' }}>
                        <h2 style={{ marginTop: 0, marginBottom: '1rem', color: '#0f172a' }}>Accept Quote {acceptingQuote.display_id}</h2>
                        <p style={{ color: '#475569', marginBottom: '1.5rem', lineHeight: '1.5' }}>
                            You are about to accept this quote for <strong>R {acceptingQuote.amount.toFixed(2)}</strong>. This will secure your booking and prevent further modifications.
                        </p>
                        
                        <form onSubmit={handleFinalizeAcceptance}>
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600, color: '#334155' }}>Any last-minute alterations or notes? (Optional)</label>
                                <textarea 
                                    rows="3"
                                    placeholder="e.g., Please ensure arrival is exactly at 9 AM."
                                    value={finalNotes}
                                    onChange={(e) => setFinalNotes(e.target.value)}
                                    className="form-input"
                                    style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #cbd5e1', boxSizing: 'border-box', fontFamily: 'inherit' }}
                                ></textarea>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                                <button type="button" onClick={() => setAcceptingQuote(null)} style={{
                                    padding: '10px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'white', cursor: 'pointer', fontWeight: 600, color: '#475569'
                                }}>Cancel</button>
                                <button type="submit" disabled={actionLoading !== null} style={{
                                    padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#16a34a', color: 'white', cursor: 'pointer', fontWeight: 600, display: 'flex', gap: '6px', alignItems: 'center'
                                }}>{actionLoading ? <BarLoader color="#fff" width={50} height={4} /> : <><FaCheck /> Finalize & Pay</>}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientQuotes;