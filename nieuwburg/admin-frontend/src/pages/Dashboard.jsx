import React, { useState, useEffect } from 'react';

// Basic component for stat cards (can be moved to its own file later)
const StatCard = ({ title, value, isLoading }) => (
  <div className="stat-card">
    <h2>{title}</h2>
    {isLoading ? (
      <p className="stat-number">...</p>
    ) : (
      <p className="stat-number">{value}</p>
    )}
  </div>
);

function Dashboard() {
  const [recentActivity, setRecentActivity] = useState([]);
  const [stats, setStats] = useState({
    new_quotes_count: 0,
    upcoming_cleans_count: 0,
    active_clients_count: 0,
    staff_members_count: 0,
  });
  const [isLoadingActivity, setIsLoadingActivity] = useState(true);
  const [isLoadingStats, setIsLoadingStats] = useState(true); // Add loading state for stats
  const [error, setError] = useState(null);

  // Fetch Recent Activity
  useEffect(() => {
    const fetchActivity = async () => {
      setIsLoadingActivity(true);
      setError(null); // Reset error before fetching
      try {
        // NOTE: Fetch uses the full path because React Router handles the /admin part
        const response = await fetch('/api/recent-activity');
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('Permission denied. Ensure you are logged in.');
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setRecentActivity(data);
      } catch (err) {
        console.error('Error fetching recent activity:', err);
        setError(`Error loading activity: ${err.message}`);
      } finally {
        setIsLoadingActivity(false);
      }
    };

    fetchActivity();
    // Optional: Set up an interval to refresh activity periodically
    // const intervalId = setInterval(fetchActivity, 30000); // Refresh every 30 seconds
    // return () => clearInterval(intervalId); // Cleanup interval on component unmount
  }, []); // Empty dependency array means this runs once on mount

  // TODO: Fetch Stats Data
  // We need an API endpoint for the dashboard stats.
  // For now, we'll just set loading to false after a delay.
  useEffect(() => {
    const fetchStats = async () => {
      setIsLoadingStats(true);
      // Reset error specific to stats, if needed, or use the general error state
      // setError(null);
      try {
        const response = await fetch('/api/admin/dashboard-stats'); // Fetch from the new endpoint
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('Permission denied fetching stats.');
          }
          throw new Error(`HTTP error fetching stats! status: ${response.status}`);
        }
        const data = await response.json();
        setStats(data); // Update state with real data
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        // Display a specific error for stats or add to a general error message
         setError(prevError => prevError ? `${prevError}\nError loading stats: ${err.message}` : `Error loading stats: ${err.message}`);
        // Optionally set stats to N/A on error
        setStats({
            new_quotes_count: 'ERR',
            upcoming_cleans_count: 'ERR',
            active_clients_count: 'ERR',
            staff_members_count: 'ERR',
        });
      } finally {
        setIsLoadingStats(false);
      }
    };

    fetchStats();
  }, []);


  return (
    <div>
      {/* Header section (already rendered by Flask template) */}
      {/* <div className="admin-header">
        <h1>Dashboard</h1>
        <p>Welcome back!</p> // Can add user info here if needed later
      </div> */}

      {/* Stats Grid */}
      <div className="stats-grid">
        <StatCard title="New Quotes" value={stats.new_quotes_count} isLoading={isLoadingStats} />
        <StatCard title="Upcoming Cleans" value={stats.upcoming_cleans_count} isLoading={isLoadingStats} />
        <StatCard title="Active Clients" value={stats.active_clients_count} isLoading={isLoadingStats} />
        <StatCard title="Staff Members" value={stats.staff_members_count} isLoading={isLoadingStats} />
      </div>

      {/* Recent Activity Section */}
      <div className="admin-section">
        <h2>Recent Activity</h2>
        <div id="recent-activity-feed">
          {isLoadingActivity ? (
            <p>Loading recent activity...</p>
          ) : error ? (
             <p style={{ color: 'red' }}>{error}</p>
          ) : recentActivity.length > 0 ? (
            recentActivity.map((log, index) => (
              <div className="activity-item" key={index}>
                <div className="activity-time">{log.timestamp}</div>
                <div className="activity-desc">{log.description}</div>
                <div className="activity-user">{log.user_email}</div>
              </div>
            ))
          ) : (
            <p>No recent activity found.</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;