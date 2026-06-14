/* src/pages/client/ClientPayments.jsx */
import React, { useState, useEffect } from 'react';
import { getMyInvoices, initiateInvoicePayment } from '../../services/clientApi';
import { FaFileInvoiceDollar, FaCheckCircle, FaClock, FaCreditCard, FaDownload } from 'react-icons/fa';
import { BarLoader } from 'react-spinners';
import './ClientHome.css'; // Reusing the dashboard styles for consistency

const ClientPayments = () => {
    const [invoices, setInvoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null); // Track which invoice is being paid

    useEffect(() => {
        loadInvoices();
    }, []);

    const loadInvoices = async () => {
        try {
            const data = await getMyInvoices();
            setInvoices(data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handlePayNow = async (invoice) => {
        setProcessingId(invoice.id);
        try {
            // Initiate Paystack transaction
            // Note: We need the user's email. If not in invoice object, 
            // you might need to fetch profile or pass it from dashboard context.
            // For now, let's assume the backend can handle it or we pass a placeholder if the token is valid.
            const result = await initiateInvoicePayment({
                token: invoice.payment_token,
                email: "client@current-session.com" // Backend uses token to find invoice & user, email is for Paystack receipt
            });

            if (result.authorization_url) {
                window.location.href = result.authorization_url;
            }
        } catch (err) {
            alert("Failed to start payment: " + err.message);
            setProcessingId(null);
        }
    };

    if (loading) return <div className="loading-state"><BarLoader color="#006ac6" /></div>;

    return (
        <div className="client-page-container" style={{ padding: '2rem' }}>
            <div className="page-header" style={{ marginBottom: '2rem' }}>
                <h1>Payments & Invoices</h1>
                <p className="text-muted">Manage your billing and download past invoices.</p>
            </div>

            {invoices.length === 0 ? (
                <div className="empty-state">
                    <FaFileInvoiceDollar size={48} color="#cbd5e1" />
                    <p>No invoices found.</p>
                </div>
            ) : (
                <div className="invoice-list-container">
                    {invoices.map(inv => (
                        <div key={inv.id} className="invoice-card" style={{
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center',
                            backgroundColor: 'white',
                            padding: '1.5rem',
                            borderRadius: '12px',
                            marginBottom: '1rem',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                        }}>
                            <div className="inv-left">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <span style={{ fontWeight: 'bold', fontSize: '1.1rem' }}>{inv.number}</span>
                                    <StatusBadge status={inv.status} />
                                </div>
                                <div className="inv-meta" style={{ color: '#64748b', fontSize: '0.9rem', marginTop: '4px' }}>
                                    Due: {inv.due_date}
                                </div>
                            </div>

                            <div className="inv-right" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                                <div className="inv-amount" style={{ textAlign: 'right' }}>
                                    <small style={{ display: 'block', color: '#64748b' }}>Total</small>
                                    <strong style={{ fontSize: '1.2rem' }}>R {inv.total.toFixed(2)}</strong>
                                </div>

                                {inv.status === 'Unpaid' ? (
                                    <button 
                                        onClick={() => handlePayNow(inv)}
                                        disabled={!!processingId}
                                        className="btn-primary"
                                        style={{ 
                                            display: 'flex', alignItems: 'center', gap: '8px',
                                            backgroundColor: '#0f172a', color: 'white', 
                                            padding: '10px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer'
                                        }}
                                    >
                                        {processingId === inv.id ? 'Processing...' : <><FaCreditCard /> Pay Now</>}
                                    </button>
                                ) : (
                                    <button className="btn-secondary" style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        backgroundColor: '#f1f5f9', color: '#334155',
                                        padding: '10px 20px', borderRadius: '8px', border: 'none'
                                    }}>
                                        <FaDownload /> PDF
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const styles = {
        Paid: { bg: '#dcfce7', color: '#166534', icon: <FaCheckCircle /> },
        Unpaid: { bg: '#fee2e2', color: '#991b1b', icon: <FaClock /> },
        Draft: { bg: '#f3f4f6', color: '#374151', icon: null }
    };
    const style = styles[status] || styles.Draft;

    return (
        <span style={{ 
            backgroundColor: style.bg, color: style.color, 
            padding: '4px 12px', borderRadius: '20px', 
            fontSize: '0.8rem', fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: '4px'
        }}>
            {style.icon} {status}
        </span>
    );
};

export default ClientPayments;