import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const ProviderDispatchModal = ({ tenantId }) => {
    const [incomingLead, setIncomingLead] = useState(null);
    const [timeLeft, setTimeLeft] = useState(0);

    // 1. Establish the WebSocket Connection
    useEffect(() => {
        if (!tenantId) return;

        // Connects to the same origin as the web server
        const socket = io(window.location.origin);
        
        socket.emit('join_tenant_room', { tenant_id: tenantId });

        socket.on('incoming_lead', (leadData) => {
            setIncomingLead(leadData);
            setTimeLeft(leadData.expires_in_seconds);
            // Pro Tip: Add a ringing audio element here later!
        });

        return () => socket.disconnect();
    }, [tenantId]);

    // 2. Handle the 60-second Countdown Timer
    useEffect(() => {
        if (timeLeft <= 0 && incomingLead) {
            setIncomingLead(null); // Auto-close when the timer dies
            return;
        }
        const timer = setInterval(() => setTimeLeft(prev => prev - 1), 1000);
        return () => clearInterval(timer);
    }, [timeLeft, incomingLead]);

    // 3. Handle the "Accept" Race Condition
    const handleAccept = async () => {
        try {
            const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
            const res = await fetch(`/api/admin/leads/${incomingLead.dispatch_id}/accept`, { 
                method: 'POST',
                headers: { 'X-CSRFToken': csrfToken }
            });
            
            if (res.ok) {
                alert("🎉 Job Secured! It has been added to your Quotes & Requests dashboard.");
                // Optionally trigger a re-fetch of your dashboard data here
            } else {
                const error = await res.json();
                alert(`Too slow: ${error.message}`); 
            }
        } catch (err) {
            alert("Network error processing your acceptance.");
        } finally {
            setIncomingLead(null);
        }
    };

    if (!incomingLead) return null;

    const progressPct = (timeLeft / 60) * 100;

    return (
        <div style={{
            position: 'fixed', bottom: '40px', right: '40px', zIndex: 9999,
            background: 'white', padding: '1.5rem', borderRadius: '16px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.3)', width: '380px',
            border: '3px solid #006ac6', fontFamily: 'inherit'
        }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, color: '#1f2937', fontSize: '1.2rem' }}>🚨 New Lead Available!</h3>
                <span style={{ 
                    background: timeLeft > 10 ? '#ef4444' : '#991b1b', 
                    color: 'white', padding: '6px 12px', borderRadius: '20px', fontWeight: 'bold' 
                }}>
                    {timeLeft}s
                </span>
            </div>
            
            <div style={{ marginTop: '1.2rem', color: '#374151' }}>
                <p style={{ margin: '5px 0', fontSize: '1.1rem' }}><strong>Service:</strong> {incomingLead.service}</p>
                <p style={{ margin: '5px 0', fontSize: '1.1rem' }}><strong>Distance:</strong> {incomingLead.distance_km} km away</p>
                <div style={{ 
                    fontStyle: 'italic', color: '#6b7280', fontSize: '0.95rem', 
                    marginTop: '12px', background: '#f3f4f6', padding: '12px', borderRadius: '8px' 
                }}>
                    "{incomingLead.description.substring(0, 100)}..."
                </div>
            </div>

            {/* Visual Expiring Progress Bar */}
            <div style={{ width: '100%', background: '#e5e7eb', height: '8px', borderRadius: '4px', margin: '1.5rem 0', overflow: 'hidden' }}>
                <div style={{ 
                    width: `${progressPct}%`, background: '#ef4444', height: '100%', 
                    borderRadius: '4px', transition: 'width 1s linear' 
                }}></div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
                <button onClick={() => setIncomingLead(null)} style={{
                    flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #d1d5db', 
                    background: 'white', cursor: 'pointer', fontWeight: 600, color: '#4b5563', transition: '0.2s'
                }}>Decline</button>
                
                <button onClick={handleAccept} style={{
                    flex: 2, padding: '12px', borderRadius: '8px', border: 'none', 
                    background: '#006ac6', color: 'white', fontWeight: 'bold', fontSize: '1.05rem', cursor: 'pointer', transition: '0.2s'
                }}>Accept Job</button>
            </div>
        </div>
    );
};

export default ProviderDispatchModal;