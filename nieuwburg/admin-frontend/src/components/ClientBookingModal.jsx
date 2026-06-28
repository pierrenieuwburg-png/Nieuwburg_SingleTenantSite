import React, { useState, useEffect, useRef } from 'react';
import { BarLoader } from 'react-spinners';
import { io } from 'socket.io-client';
import { createBooking, initiateQuickBookPayment } from '../services/clientApi';

// Quick Book client "Pulse" (P2-1). Phases:
//   form      -> the booking form
//   searching -> joined client_job_{id}, pulsing "Searching for pros nearby…"
//   found     -> 'pro_found' arrived: confirm + Proceed-to-payment button
//   no_pro    -> 'no_pro_found' (P1-4 timeout): posted to marketplace message
//   unavailable -> payment endpoint refused (no price yet, BACKLOG #7)
//   error     -> any other payment-init failure (clean terminal message)
const ClientBookingModal = ({ isOpen, onClose, preselectedService, onSuccess }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        frequency: 'Once-off',
        date: '',
        time: '09:00',
        notes: ''
    });

    const [phase, setPhase] = useState('form');
    const [jobId, setJobId] = useState(null);
    const [providerName, setProviderName] = useState('');
    const [infoMessage, setInfoMessage] = useState('');
    const [paying, setPaying] = useState(false);
    const socketRef = useRef(null);

    // Realtime: only while actively searching. Joins client_job_{jobId} so the
    // server's 'pro_found' (accept_lead) and 'no_pro_found' (P1-4 sweep) reach us.
    useEffect(() => {
        if (phase !== 'searching' || !jobId) return;

        const socket = io(window.location.origin);
        socketRef.current = socket;
        socket.emit('join_client_job_room', { job_id: jobId });

        socket.on('pro_found', (data) => {
            setProviderName(data?.provider_name || 'A verified pro');
            setPhase('found');
        });
        socket.on('no_pro_found', (data) => {
            setInfoMessage(data?.message || "No pro grabbed it instantly — we've posted it for custom quotes.");
            setPhase('no_pro');
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [phase, jobId]);

    // Reset to a clean form whenever the modal is closed, so reopening starts
    // fresh (and the searching socket effect tears down).
    useEffect(() => {
        if (!isOpen) {
            setPhase('form');
            setJobId(null);
            setProviderName('');
            setInfoMessage('');
            setPaying(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e) => {
        e.preventDefault();

        // --- ADDED SUBMIT FRICTION HERE ---
        if (!window.confirm("Are you ready to submit your request? No further edits can be made once submitted.")) return;

        setLoading(true);
        try {
            const result = await createBooking({
                service_type: preselectedService,
                ...formData
            });
            if (onSuccess) onSuccess();
            // Hand off to the live "Searching…" pulse — the socket effect joins
            // the job room and waits for pro_found / no_pro_found.
            setJobId(result.job_id);
            setPhase('searching');
        } catch (err) {
            alert(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleProceedToPayment = async () => {
        setPaying(true);
        try {
            const { authorization_url } = await initiateQuickBookPayment(jobId);
            window.location.href = authorization_url;   // off to Paystack
        } catch (err) {
            if (err.status === 400) {
                // Endpoint refuses until the pricing catalog exists (BACKLOG #7).
                setInfoMessage("A pro accepted your job, but instant booking isn't available for this service yet. We'll be in touch to finalise the details.");
                setPhase('unavailable');
            } else {
                setInfoMessage(err.message || "Something went wrong starting payment. Please try again shortly.");
                setPhase('error');
            }
        } finally {
            setPaying(false);
        }
    };

    const overlayStyle = {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    };

    const modalStyle = {
        backgroundColor: 'white', padding: '2rem', borderRadius: '12px', width: '90%', maxWidth: '500px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.1)'
    };

    const primaryBtn = {
        padding: '10px 20px', border: 'none', borderRadius: '6px', cursor: 'pointer',
        background: '#0f172a', color: 'white', fontWeight: 'bold'
    };
    const secondaryBtn = {
        padding: '10px 20px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#666'
    };

    // --- Status panels (searching / found / terminal messages) ---
    const renderStatus = () => {
        if (phase === 'searching') {
            return (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <h2 style={{ marginTop: 0 }}>Searching for pros nearby…</h2>
                    <p style={{ color: '#475569' }}>Hold tight — we're pinging available pros around you.</p>
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '1.5rem 0' }}>
                        <BarLoader color="#0f172a" width={200} />
                    </div>
                    <button type="button" onClick={onClose} style={secondaryBtn}>Cancel search</button>
                </div>
            );
        }

        if (phase === 'found') {
            return (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                    <h2 style={{ marginTop: 0, color: '#15803d' }}>🎉 Pro found!</h2>
                    <p style={{ fontSize: '1.1rem', color: '#1f2937' }}>
                        <strong>{providerName}</strong> has accepted your request.
                    </p>
                    <p style={{ color: '#475569', marginBottom: '1.5rem' }}>
                        Secure your booking by completing payment.
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
                        <button type="button" onClick={onClose} style={secondaryBtn}>Not now</button>
                        <button type="button" onClick={handleProceedToPayment} disabled={paying}
                            style={{ ...primaryBtn, background: '#006ac6', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {paying ? <BarLoader color="white" height={4} width={50} /> : 'Proceed to secure payment'}
                        </button>
                    </div>
                </div>
            );
        }

        // Terminal informational phases (no_pro / unavailable / error)
        const headings = {
            no_pro: "No instant match",
            unavailable: "Pro found",
            error: "Something went wrong"
        };
        return (
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                <h2 style={{ marginTop: 0 }}>{headings[phase] || 'Update'}</h2>
                <p style={{ color: '#475569', margin: '1rem 0 1.5rem' }}>{infoMessage}</p>
                <button type="button" onClick={onClose} style={primaryBtn}>Got it</button>
            </div>
        );
    };

    return (
        <div style={overlayStyle}>
            <div style={modalStyle}>
                {phase === 'form' ? (
                    <>
                        <h2 style={{marginTop: 0}}>Book {preselectedService}</h2>
                        <form onSubmit={handleSubmit} style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>

                            <label>
                                <strong>When?</strong>
                                <div style={{display: 'flex', gap: '10px', marginTop: '5px'}}>
                                    <input type="date" required className="form-input"
                                        style={{flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid #ddd'}}
                                        value={formData.date}
                                        onChange={e => setFormData({...formData, date: e.target.value})}
                                    />
                                    <input type="time" required className="form-input"
                                        style={{width: '100px', padding: '8px', borderRadius: '6px', border: '1px solid #ddd'}}
                                        value={formData.time}
                                        onChange={e => setFormData({...formData, time: e.target.value})}
                                    />
                                </div>
                            </label>

                            <label>
                                <strong>Frequency</strong>
                                <select className="form-input"
                                    style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', marginTop: '5px'}}
                                    value={formData.frequency}
                                    onChange={e => setFormData({...formData, frequency: e.target.value})}
                                >
                                    <option>Once-off</option>
                                    <option>Weekly</option>
                                    <option>Bi-Weekly</option>
                                    <option>Monthly</option>
                                </select>
                            </label>

                            <label>
                                <strong>Notes / Specific Requirements</strong>
                                <textarea className="form-input" rows="3"
                                    style={{width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid #ddd', marginTop: '5px'}}
                                    placeholder="E.g. I have 3 bedrooms, please bring vacuum..."
                                    value={formData.notes}
                                    onChange={e => setFormData({...formData, notes: e.target.value})}
                                ></textarea>
                            </label>

                            <div style={{display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '1rem'}}>
                                <button type="button" onClick={onClose} style={secondaryBtn}>Cancel</button>
                                <button type="submit" disabled={loading} style={{
                                    ...primaryBtn, display: 'flex', alignItems: 'center', gap: '10px'
                                }}>
                                    {loading ? <BarLoader color="white" height={4} width={50} /> : 'Request Booking'}
                                </button>
                            </div>
                        </form>
                    </>
                ) : renderStatus()}
            </div>
        </div>
    );
};

export default ClientBookingModal;
