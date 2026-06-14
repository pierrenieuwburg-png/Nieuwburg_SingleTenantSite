import React, { useState, useEffect } from 'react';
import { getMyQuotes, downloadQuotePdf, respondToQuote } from '../../services/clientApi';
import { FaFileInvoice, FaCheck, FaTimes, FaDownload } from 'react-icons/fa';
import { BarLoader } from 'react-spinners';
import './ClientHome.css'; // Reusing styles

const ClientQuotes = () => {
    const [quotes, setQuotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(null); // ID of quote being processed

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const data = await getMyQuotes();
            setQuotes(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (q) => {
        try {
            await downloadQuotePdf(q.id, q.display_id);
        } catch (e) {
            alert("Could not download PDF");
        }
    };

    const handleResponse = async (q, action) => {
        if(!window.confirm(`Are you sure you want to ${action} this quote?`)) return;
        
        setActionLoading(q.id);
        try {
            await respondToQuote(q.id, action);
            await loadData(); // Refresh list to see new status
        } catch (e) {
            alert(e.message);
        } finally {
            setActionLoading(null);
        }
    };

    if (loading) return <div className="loading-state"><BarLoader color="#006ac6" /></div>;

    return (
        <div className="client-page-container" style={{ padding: '2rem' }}>
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <h1>My Quotes & Requests</h1>
                <p className="text-muted">View your requests and approve formal quotes.</p>
            </div>

            {quotes.length === 0 ? (
                <div className="empty-state">
                    <FaFileInvoice size={48} color="#cbd5e1" />
                    <p>No quotes found.</p>
                </div>
            ) : (
                <div className="invoice-list-container">
                    {quotes.map(item => (
                        <div key={`${item.type}-${item.id}`} className="invoice-card" style={{
                            backgroundColor: 'white', padding: '1.5rem', borderRadius: '12px',
                            marginBottom: '1rem', boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem'
                        }}>
                            {/* Left Info */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{item.display_id}</span>
                                    <span className={`status-pill ${item.status.toLowerCase().replace(' ', '-')}`}>{item.status}</span>
                                </div>
                                <div style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
                                    {item.service_title} • {item.date}
                                </div>
                            </div>

                            {/* Right Actions */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {item.amount > 0 && (
                                    <strong style={{ fontSize: '1.2rem', marginRight: '10px' }}>R {item.amount.toFixed(2)}</strong>
                                )}

                                {item.type === 'formal' && (
                                    <>
                                        <button onClick={() => handleDownload(item)} className="btn-icon" title="Download PDF" style={{
                                            background: '#f1f5f9', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', color: '#334155'
                                        }}>
                                            <FaDownload />
                                        </button>

                                        {/* Only show actions if Sent */}
                                        {item.status === 'Sent' && (
                                            <>
                                                <button 
                                                    onClick={() => handleResponse(item, 'accept')} 
                                                    disabled={actionLoading === item.id}
                                                    style={{
                                                        background: '#dcfce7', color: '#166534', border: 'none', 
                                                        padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', gap: '6px', alignItems: 'center'
                                                    }}
                                                >
                                                    <FaCheck /> Accept
                                                </button>
                                                <button 
                                                    onClick={() => handleResponse(item, 'reject')}
                                                    disabled={actionLoading === item.id}
                                                    style={{
                                                        background: '#fee2e2', color: '#991b1b', border: 'none', 
                                                        padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', gap: '6px', alignItems: 'center'
                                                    }}
                                                >
                                                    <FaTimes /> Reject
                                                </button>
                                            </>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ClientQuotes;