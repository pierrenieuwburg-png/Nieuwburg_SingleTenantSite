import React, { useState, useEffect, useCallback } from 'react';
import { BarLoader } from 'react-spinners';

// Available Leads board (P2-2) — the provider's marketplace INBOX of incoming
// floating work. Designed for TWO sections:
//   1. Quick Book leads  (floating, time-sensitive, fixed price)  -> BUILT here.
//   2. Quote requests     (custom, stay longer, need a quote)      -> P2-3.
// P2-2 builds + styles section 1 and leaves section 2 as a clearly-marked
// placeholder so the page grows into the full inbox.
function AvailableLeads() {
    const [leads, setLeads] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [claimingId, setClaimingId] = useState(null);
    const [toast, setToast] = useState(null);

    const fetchLeads = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/admin/available-leads');
            if (!res.ok) {
                throw new Error(res.status === 403 ? 'Permission denied.' : `Failed to load leads (HTTP ${res.status}).`);
            }
            setLeads(await res.json());
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchLeads(); }, [fetchLeads]);

    const showToast = (msg) => {
        setToast(msg);
        setTimeout(() => setToast(null), 4000);
    };

    const handleClaim = async (leadId) => {
        setClaimingId(leadId);
        try {
            const res = await fetch(`/api/admin/available-leads/${leadId}/claim`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setLeads(prev => prev.filter(l => l.id !== leadId));   // leaves the board
                showToast(data.message || 'Lead claimed!');
            } else if (res.status === 409) {
                setLeads(prev => prev.filter(l => l.id !== leadId));   // someone else won — drop it
                showToast('That lead was just claimed by another provider.');
            } else {
                showToast(data.message || 'Could not claim that lead.');
            }
        } catch {
            showToast('Network error claiming the lead.');
        } finally {
            setClaimingId(null);
        }
    };

    const quickBookLeads = leads.filter(l => l.lead_type === 'quick_book');

    const formatPrice = (p) => (p && p > 0) ? `R${Number(p).toFixed(2)}` : 'Price pending';
    const formatAge = (iso) => {
        if (!iso) return '';
        const mins = Math.max(0, Math.round((Date.now() - new Date(iso + 'Z').getTime()) / 60000));
        if (mins < 60) return `${mins} min ago`;
        const hrs = Math.round(mins / 60);
        return hrs < 24 ? `${hrs} hr ago` : `${Math.round(hrs / 24)} d ago`;
    };

    return (
        <div style={{ padding: '2rem', maxWidth: '1100px', margin: '0 auto' }}>
            <h1 style={{ marginTop: 0 }}>Available Leads</h1>
            <p style={{ color: '#64748b', marginTop: '-0.5rem' }}>
                Incoming marketplace work. Claim a lead to add it to your pipeline.
            </p>

            {toast && (
                <div style={{
                    background: '#0f172a', color: 'white', padding: '12px 18px', borderRadius: '8px',
                    margin: '1rem 0', fontWeight: 600
                }}>{toast}</div>
            )}

            {/* ---------- SECTION 1: Quick Book floating leads (BUILT) ---------- */}
            <section style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
                    <h2 style={{ margin: 0 }}>⚡ Live Quick Book Leads</h2>
                    <span style={{
                        background: '#fef3c7', color: '#92400e', padding: '3px 10px',
                        borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700
                    }}>TIME-SENSITIVE · FIXED PRICE</span>
                </div>

                {isLoading && <BarLoader color="#0f172a" width={180} />}
                {error && <p style={{ color: '#b91c1c' }}>{error}</p>}

                {!isLoading && !error && quickBookLeads.length === 0 && (
                    <p style={{ color: '#64748b' }}>No live Quick Book leads right now.</p>
                )}

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                    {quickBookLeads.map(lead => (
                        <div key={lead.id} style={{
                            border: '2px solid #f59e0b', borderRadius: '12px', padding: '1.1rem',
                            background: '#fffbeb', boxShadow: '0 4px 10px rgba(0,0,0,0.04)'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <strong style={{ fontSize: '1.1rem', color: '#1f2937' }}>{lead.service}</strong>
                                <span style={{ fontWeight: 700, color: '#92400e' }}>{formatPrice(lead.price)}</span>
                            </div>
                            {lead.category && <div style={{ color: '#6b7280', fontSize: '0.9rem', marginTop: '2px' }}>{lead.category}</div>}
                            {lead.description && (
                                <p style={{ color: '#475569', fontSize: '0.92rem', margin: '0.75rem 0' }}>
                                    {lead.description.length > 120 ? lead.description.slice(0, 120) + '…' : lead.description}
                                </p>
                            )}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.75rem' }}>
                                <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>{formatAge(lead.requested_at)}</span>
                                <button onClick={() => handleClaim(lead.id)} disabled={claimingId === lead.id}
                                    style={{
                                        padding: '9px 18px', border: 'none', borderRadius: '8px', cursor: 'pointer',
                                        background: '#006ac6', color: 'white', fontWeight: 'bold',
                                        display: 'flex', alignItems: 'center', gap: '8px'
                                    }}>
                                    {claimingId === lead.id ? <BarLoader color="white" height={4} width={40} /> : 'Claim lead'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {/* ---------- SECTION 2: Quote requests (PLACEHOLDER — P2-3) ---------- */}
            <section style={{ marginTop: '2.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '0.75rem' }}>
                    <h2 style={{ margin: 0, color: '#475569' }}>📋 Quote Requests</h2>
                    <span style={{
                        background: '#e2e8f0', color: '#475569', padding: '3px 10px',
                        borderRadius: '20px', fontSize: '0.8rem', fontWeight: 700
                    }}>CUSTOM · NEEDS A QUOTE</span>
                </div>
                <div style={{
                    border: '2px dashed #cbd5e1', borderRadius: '12px', padding: '1.5rem',
                    color: '#94a3b8', textAlign: 'center'
                }}>
                    Custom quote-request leads will appear here (coming with the marketplace search work, P2-3).
                </div>
            </section>
        </div>
    );
}

export default AvailableLeads;
