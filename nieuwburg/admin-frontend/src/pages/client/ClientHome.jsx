import React, { useState, useEffect } from 'react';
import { getClientDashboard, getMyBookings } from '../../services/clientApi';
import { FaBroom, FaTools, FaTree, FaArrowRight, FaPlus, FaHistory, FaCalendarCheck, FaFileInvoiceDollar } from 'react-icons/fa'; 
import './ClientHome.css';
import { useNavigate } from 'react-router-dom';
import ClientBookingModal from '../../components/ClientBookingModal';

const ClientHome = () => {
    const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState({ name: 'Client' });
  const [stats, setStats] = useState({});
  const [upcomingJob, setUpcomingJob] = useState(null);
  const [bookingHistory, setBookingHistory] = useState([]);
  const [bookingModal, setBookingModal] = useState({ open: false, service: '' });
  const openBooking = (service) => setBookingModal({ open: true, service });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [dashData, bookingsData] = await Promise.all([
          getClientDashboard(),
          getMyBookings()
        ]);
        
        setProfile(dashData.profile || {});
        setStats(dashData.stats || {});
        
        // --- LOGIC: Separate Future vs Past Jobs ---
        if (bookingsData && Array.isArray(bookingsData)) {
            const now = new Date();
            
            // 1. Sort all by date descending (newest first)
            const sorted = bookingsData.sort((a, b) => new Date(b.date) - new Date(a.date));

            // 2. Find the immediate next job (Future)
            // We reverse temporarily to find the earliest future date
            const upcoming = bookingsData
                .filter(b => new Date(b.date) >= now.setHours(0,0,0,0))
                .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
            
            setUpcomingJob(upcoming || null);

            // 3. Filter for History (Past jobs)
            const history = sorted.filter(b => new Date(b.date) < now.setHours(0,0,0,0));
            setBookingHistory(history.slice(0, 5)); // Limit to last 5
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading-state">Loading...</div>;
  
  return (
    <div className="client-home-container">
      {/* 1. NEW: Action Alert Widget (Insert before Service Dock or in layout-main) */}
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

      {/* SECTION 1: Service Dock */}
      <section className="service-dock-section">
        <h2 className="section-heading">Start a new request</h2>
        <div className="service-dock">
            <button className="service-card" onClick={() => window.location.href = '/#booking-section'}>
                <div className="icon-box clean"><FaBroom /></div>
                <span>Cleaning</span>
            </button>
            <button className="service-card" onClick={() => window.location.href = '/#booking-section'}>
                <div className="icon-box garden"><FaTree /></div>
                <span>Gardening</span>
            </button>
            <button className="service-card" onClick={() => window.location.href = '/#booking-section'}>
                <div className="icon-box fix"><FaTools /></div>
                <span>Maintenance</span>
            </button>
            <button className="service-card new">
                <div className="icon-box add"><FaPlus /></div>
                <span>Other</span>
            </button>
        </div>
      </section>

      <div className="dashboard-split-layout">
        
        {/* LEFT COLUMN: Active Stuff */}
        <div className="layout-main">
            
            {/* 1. UPCOMING JOB CARD */}
            <div className="status-card">
                <div className="card-header">
                    <h3>Next Scheduled Jobs</h3>
                    <button className="btn-text">View All <FaArrowRight /></button>
                </div>
                {upcomingJob ? (
                    <div className="job-preview-row">
                        <div className="date-box">
                            <span className="day">{new Date(upcomingJob.date).getDate()}</span>
                            <span className="month">{new Date(upcomingJob.date).toLocaleString('default', { month: 'short' })}</span>
                        </div>
                        <div className="job-info">
                            <h4>{upcomingJob.service_name}</h4>
                            <p>{upcomingJob.time} • Assigned Staff</p>
                        </div>
                        <span className={`status-pill ${upcomingJob.status.toLowerCase().replace(' ', '-')}`}>{upcomingJob.status}</span>
                    </div>
                ) : (
                    <div className="empty-job-state">
                        <p>No upcoming jobs scheduled.</p>
                    </div>
                )}
            </div>

            {/* 2. BOOKING HISTORY (NEW SECTION) */}
            <div className="history-section">
                <div className="card-header">
                    <h3>Booking History</h3>
                    {/* Link to full bookings page */}
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
                                <span className={`status-text ${job.status.toLowerCase().replace(' ', '-')}`}>
                                    {job.status}
                                </span>
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
                        <button className="btn-sm">Book</button>
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

        </div>

        {/* RIGHT COLUMN: Wallet & Promos */}
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