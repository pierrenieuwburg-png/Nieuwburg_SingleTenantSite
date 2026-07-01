import React, { useState, useEffect } from 'react';
import { getClientDashboard, getMyBookings } from '../../services/clientApi';
import { 
    FaBroom, FaTools, FaTree, FaArrowRight, FaPlus, 
    FaCalendarCheck, FaFileInvoiceDollar, FaFileInvoice, 
    FaSyncAlt, FaCar, FaCheckCircle, FaStar 
} from 'react-icons/fa'; 

import './ClientHome.css';
import { useNavigate } from 'react-router-dom';

// --- MODAL IMPORTS ---
import ClientBookingModal from '../../components/ClientBookingModal';
import CustomRequestModal from '../../components/client/CustomRequestModal';
import ServiceDiscovery from '../../components/client/ServiceDiscovery';

const ClientHome = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState({ name: 'Client' });
    const [stats, setStats] = useState({});
    const [upcomingJob, setUpcomingJob] = useState(null);
    const [bookingHistory, setBookingHistory] = useState([]);
    
    // --- MODAL STATES ---
    const [bookingModal, setBookingModal] = useState({ open: false, service: '' });
    const [customRequestModal, setCustomRequestModal] = useState({ open: false, category: '' });
    
    // Rating & Tipping State
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [tipAmount, setTipAmount] = useState(0);

    // --- ROUTING HANDLERS ---
    const openBooking = (service) => setBookingModal({ open: true, service });
    const openCustomRequest = (category) => setCustomRequestModal({ open: true, category });

    // F5: a discovery tile routes to the right EXISTING flow based on the item.
    // Quick-bookable -> Quick Book modal; otherwise -> the quote-request modal.
    const handleServiceSelect = (svc) => {
        if (svc.is_quick_bookable) openBooking(svc.name);
        else openCustomRequest(svc.name);
    };

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [dashData, bookingsData] = await Promise.all([
                    getClientDashboard(),
                    getMyBookings()
                ]);
                
                setProfile(dashData.profile || {});
                setStats(dashData.stats || {});
                
                if (bookingsData && Array.isArray(bookingsData)) {
                    const now = new Date();
                    const sorted = bookingsData.sort((a, b) => new Date(b.date) - new Date(a.date));

                    // A job completed *today* will still show in upcoming, so we can rate it!
                    const upcoming = bookingsData
                        .filter(b => new Date(b.date) >= now.setHours(0,0,0,0))
                        .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
                    
                    setUpcomingJob(upcoming || null);

                    const history = sorted.filter(b => new Date(b.date) < now.setHours(0,0,0,0));
                    setBookingHistory(history.slice(0, 5));
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    const handleSubmitReview = () => {
        alert(`Thank you! Rating: ${rating} Stars. Tip: R${tipAmount} sent from your wallet.`);
        // Temporarily dismiss the card to show the empty state after rating
        setUpcomingJob(null);
    };

    if (loading) return <div className="loading-state">Loading...</div>;
  
    return (
        <div className="client-home-container">
            
            {stats.unpaid_invoices > 0 && (
                <div className="alert-banner" style={{
                    backgroundColor: '#fff1f2', border: '1px solid #fecaca', borderRadius: '8px',
                    padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#991b1b' }}>
                        <FaFileInvoiceDollar size={20} />
                        <span>You have <strong>{stats.unpaid_invoices} unpaid invoice(s)</strong> requiring attention.</span>
                    </div>
                    <button 
                        onClick={() => navigate('/client/dashboard/payments')}
                        style={{ backgroundColor: '#991b1b', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer' }}
                    >
                        View Invoices
                    </button>
                </div>
            )}

            {stats.pending_quotes > 0 && (
                <div className="alert-banner" style={{
                    backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px',
                    padding: '16px', marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#166534' }}>
                        <FaFileInvoice size={20} />
                        <span>You have <strong>{stats.pending_quotes} custom quote(s)</strong> ready for review.</span>
                    </div>
                    <button 
                        onClick={() => navigate('/client/dashboard/quotes')}
                        style={{ backgroundColor: '#166534', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        View Quotes
                    </button>
                </div>
            )}

            {/* F5: catalogue-driven discovery tiles (replaces the hardcoded set).
                Routes each tile to the existing Quick Book / quote-request modal. */}
            <ServiceDiscovery onSelect={handleServiceSelect} />

            <div className="dashboard-split-layout">
                <div className="layout-main">
                    
                    {/* 1. UPCOMING JOB CARD */}
                    <div className="status-card">
                        <div className="card-header">
                            <h3>Next Scheduled Jobs</h3>
                            <button className="btn-text" onClick={() => window.location.href='/client/dashboard/bookings'}>View All <FaArrowRight /></button>
                        </div>
                        {upcomingJob ? (
                            <div className="upcoming-job-wrapper">
                                <div className="job-preview-row" style={{ background: 'transparent', padding: '0', border: 'none' }}>
                                    <div className="date-box">
                                        <span className="day">{new Date(upcomingJob.date).getDate()}</span>
                                        <span className="month">{new Date(upcomingJob.date).toLocaleString('default', { month: 'short' })}</span>
                                    </div>
                                    <div className="job-info">
                                        <h4>{upcomingJob.service_name}</h4>
                                        <p>{upcomingJob.time} • {upcomingJob.staff_assigned || 'Pro Assigned'}</p>
                                    </div>
                                    <span className={`status-pill ${(upcomingJob.status || 'unknown').toLowerCase().replace(' ', '-')}`}>
                                        {upcomingJob.status || 'Unknown'}
                                    </span>
                                </div>
                                
                                {/* DYNAMIC WIDGET: If completed, show Rating. Otherwise, show Tracker. */}
                                {(upcomingJob.status || '').toLowerCase() === 'completed' ? (
                                    <div className="review-widget-container">
                                        <h4>Rate your pro's service today</h4>
                                        <div className="stars-row">
                                            {[1, 2, 3, 4, 5].map(star => (
                                                <FaStar
                                                    key={star}
                                                    size={32}
                                                    color={star <= (hoverRating || rating) ? "#fbbf24" : "#e5e7eb"}
                                                    onMouseEnter={() => setHoverRating(star)}
                                                    onMouseLeave={() => setHoverRating(0)}
                                                    onClick={() => setRating(star)}
                                                    style={{ cursor: 'pointer', transition: 'color 0.2s', stroke: '#f59e0b', strokeWidth: star <= (hoverRating || rating) ? '0' : '20px' }}
                                                />
                                            ))}
                                        </div>
                                        
                                        {/* Tipping only appears AFTER they select a star */}
                                        {rating > 0 && (
                                            <div className="tipping-section">
                                                <p>Say thanks with a tip (100% goes to them)</p>
                                                <div className="tip-buttons">
                                                    {[0, 50, 100, 150].map(amount => (
                                                        <button
                                                            key={amount}
                                                            className={`btn-tip ${tipAmount === amount ? 'active' : ''}`}
                                                            onClick={() => setTipAmount(amount)}
                                                        >
                                                            {amount === 0 ? 'No Tip' : `R${amount}`}
                                                        </button>
                                                    ))}
                                                </div>
                                                <button className="btn-submit-review" onClick={handleSubmitReview}>
                                                    Submit Review {tipAmount > 0 ? `& Pay R${tipAmount}` : ''}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="live-tracker-container">
                                        <div className="tracker-stepper">
                                            {['Scheduled', 'En Route', 'In Progress', 'Completed'].map((status, index) => {
                                                const safeStatus = upcomingJob.status || 'Unknown';
                                                const flowStatuses = ['Scheduled', 'En Route', 'In Progress', 'Completed'];
                                                let currentIndex = flowStatuses.indexOf(safeStatus);
                                                if (currentIndex === -1) currentIndex = 0; 
                                                
                                                let stepClass = 'tracker-step';
                                                if (index < currentIndex) stepClass += ' completed';
                                                if (index === currentIndex) stepClass += ' active';
                                                
                                                let Icon = FaCalendarCheck;
                                                if (status === 'En Route') Icon = FaCar;
                                                if (status === 'In Progress') Icon = FaBroom;
                                                if (status === 'Completed') Icon = FaCheckCircle;

                                                return (
                                                    <div key={status} className={stepClass}>
                                                        <div className="step-icon"><Icon /></div>
                                                        <span className="step-label">{status}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                            </div>
                        ) : (
                            <div className="magnetic-empty-state">
                                <div className="empty-state-icon">
                                    <FaCalendarCheck size={36} />
                                </div>
                                <h4>Your schedule is clear!</h4>
                                <p>Let's get your space sparkling.</p>
                                <button 
                                    className="btn-primary-action" 
                                    onClick={() => openBooking('Cleaning')}
                                >
                                    Book a Clean
                                </button>
                            </div>
                        )}
                    </div>

                    {/* 2. BOOKING HISTORY */}
                    <div className="history-section">
                        <div className="card-header">
                            <h3>Booking History</h3>
                            <button className="btn-text" onClick={() => window.location.href='/client/dashboard/bookings'}>
                                Full History <FaArrowRight />
                            </button>
                        </div>
                        
                        <div className="history-list">
                            {bookingHistory.length === 0 ? (
                                <div className="empty-job-state">No past bookings found.</div>
                            ) : (
                                bookingHistory.map((job) => (
                                    <div key={job.id} className="history-row">
                                        <div className="history-icon">
                                            <FaCalendarCheck />
                                        </div>
                                        <div className="history-details">
                                            <strong>{job.service_name}</strong>
                                            <span className="history-date">{job.date}</span>
                                        </div>
                                        <div className="history-actions">
                                            <span className={`status-text ${(job.status || 'unknown').toLowerCase().replace(' ', '-')}`}>
                                                {job.status || 'Unknown'}
                                            </span>
                                            <button 
                                                className="btn-rebook" 
                                                onClick={() => openBooking(job.service_name)}
                                            >
                                                <FaSyncAlt /> Book Again
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* 3. MY TEAM SECTION */}
                    <div className="team-section">
                        <h3 className="section-heading">My BlitzHelp Team</h3>
                        <div className="team-grid">
                            <div className="team-card">
                                <div className="avatar">S</div>
                                <div className="team-info">
                                    <strong>Sarah J.</strong>
                                    <span>Residential Cleaner</span>
                                </div>
                                <button 
                                    className="btn-sm" 
                                    onClick={() => openBooking('Cleaning')}
                                >
                                    Request Sarah
                                </button>
                            </div>
                            
                            <div className="team-card add-new">
                                <div className="avatar-plus">+</div>
                                <div className="team-info">
                                    <strong>Find Help</strong>
                                    <span>Browse Pros</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* THE STANDARD BOOKING MODAL (Cart Method) */}
                    <ClientBookingModal 
                        isOpen={bookingModal.open} 
                        onClose={() => setBookingModal({ open: false, service: '' })}
                        preselectedService={bookingModal.service}
                    />

                    {/* THE NEW LIVE DISPATCH MODAL (Uber Method) */}
                    <CustomRequestModal 
                        isOpen={customRequestModal.open} 
                        onClose={() => setCustomRequestModal({ open: false, category: '' })} 
                        selectedCategory={customRequestModal.category}
                    />
                    
                </div>

                {/* RIGHT COLUMN */}
                <div className="layout-side">
                    <div className="wallet-widget">
                        <small>Available Credit</small>
                        <div className="balance">R 0.00</div>
                        <div className="wallet-actions">
                            <button>Top Up</button>
                            <button>Refer Friend</button>
                        </div>
                    </div>

                    <div className="promo-widget">
                        <strong>Refer & Earn</strong>
                        <p>Get R150 for every friend who books their first clean.</p>
                        <button className="btn-block">Copy Link</button>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default ClientHome;