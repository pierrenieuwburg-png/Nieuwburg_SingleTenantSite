import React, { useState, useEffect } from 'react';

function ActivityLog() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchActivityLogs = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/recent-activity'); // Relative URL uses basename
        if (!response.ok) {
          if (response.status === 403) {
            throw new Error('Permission denied fetching activity logs.');
          }
          throw new Error(`HTTP error fetching logs! status: ${response.status}`);
        }
        const data = await response.json();
        // Limit to more logs if needed, API currently sends 5
        setLogs(data);
      } catch (err) {
        console.error('Error fetching activity logs:', err);
        setError(`Error loading activity: ${err.message}`);
        setLogs([]); // Clear logs on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchActivityLogs();
  }, []); // Run once on mount

  // Client-side live filter: logs are already loaded, so filter in memory
  // (no extra request). Matches against timestamp, user, and description.
  const query = searchTerm.trim().toLowerCase();
  const filteredLogs = query
    ? logs.filter((log) =>
        (log.timestamp || '').toLowerCase().includes(query) ||
        (log.user_email || '').toLowerCase().includes(query) ||
        (log.description || '').toLowerCase().includes(query)
      )
    : logs;

  return (
    <div>
      <div className="admin-header">
        <h1>Activity Log</h1>
        <p>Recent actions performed by administrators and system events.</p>
      </div>

      {error && (
        <div className="flash error" style={{ marginBottom: '20px' }}>
          {error}
        </div>
      )}

      <div className="admin-section">
        <h2>Recent Activity</h2>
        {isLoading ? (
          <p>Loading activity logs...</p>
        ) : logs.length > 0 ? (
          <>
          <div className="form-group" style={{ marginBottom: '20px', maxWidth: '400px' }}>
            <label htmlFor="activity-search" className="form-label">Search Activity</label>
            <input
              type="text"
              id="activity-search"
              className="form-control"
              placeholder="Search by user, action, or timestamp..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp (SAST)</th>
                <th>User</th>
                <th>Action / Description</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="3" style={{ textAlign: 'center', padding: '20px' }}>
                    No activity matches your search.
                  </td>
                </tr>
              ) : filteredLogs.map((log, index) => (
                <tr key={index}> {/* Use index if no unique ID is available */}
                  <td>{log.timestamp}</td>
                  <td>{log.user_email}</td>
                  <td>{log.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </>
        ) : (
          <p>No recent activity found.</p>
        )}
      </div>
    </div>
  );
}

export default ActivityLog;