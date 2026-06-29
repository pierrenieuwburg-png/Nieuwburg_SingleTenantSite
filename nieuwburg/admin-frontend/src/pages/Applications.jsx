import React, { useState, useEffect } from 'react';

function Applications() {
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchApplications = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/admin/applications'); // Fetch from the new endpoint
        if (!response.ok) {
           if (response.status === 403) {
            throw new Error('Permission denied fetching applications.');
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        setApplications(data);
      } catch (err) {
        console.error('Error fetching applications:', err);
        setError(`Error loading applications: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplications();
  }, []); // Run once on mount

  // Function to generate link for viewing uploaded documents
  const getDocumentLink = (filename) => {
    // Assumes documents are stored in '/static/uploads/' relative to the domain root
    return `/static/uploads/${filename}`;
  };

  // Client-side live filter: applications are already loaded, so filter in memory
  // (no extra request). Matches against name, email, phone, and ID number.
  const query = searchTerm.trim().toLowerCase();
  const filteredApplications = query
    ? applications.filter((app) =>
        (app.full_name || '').toLowerCase().includes(query) ||
        (app.email || '').toLowerCase().includes(query) ||
        (app.phone_number || '').toLowerCase().includes(query) ||
        (app.id_number || '').toLowerCase().includes(query)
      )
    : applications;

  return (
    <div>
      <div className="admin-header">
        <h1>Blitz Applications</h1>
        <p>A list of submitted applications from potential staff.</p>
      </div>

      <div className="admin-section">
        {isLoading ? (
          <p>Loading applications...</p>
        ) : error ? (
           <p style={{ color: 'red' }}>{error}</p>
        ) : (
          <>
          {applications.length > 0 && (
            <div className="form-group" style={{ marginBottom: '20px', maxWidth: '400px' }}>
              <label htmlFor="application-search" className="form-label">Search Applications</label>
              <input
                type="text"
                id="application-search"
                className="form-control"
                placeholder="Search by name, email, phone, or ID number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          )}

          <table className="data-table">
            <thead>
              <tr>
                <th>Received</th>
                <th>Name</th>
                <th>ID Number</th>
                <th>Contact</th>
                <th>Documents</th>
              </tr>
            </thead>
            <tbody>
              {applications.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                    No applications have been submitted yet.
                  </td>
                </tr>
              ) : filteredApplications.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                    No applications match your search.
                  </td>
                </tr>
              ) : (
                filteredApplications.map((app) => (
                  <tr key={app.id}>
                    <td>{app.submission_date}</td>
                    <td>{app.full_name}</td>
                    <td>{app.id_number}</td>
                    <td>
                      {app.email}<br />{app.phone_number}
                    </td>
                    <td>
                      {app.document_filenames.length > 0 ? (
                        app.document_filenames.map((doc, index) => (
                          <React.Fragment key={index}>
                            <a
                              href={getDocumentLink(doc)}
                              target="_blank"
                              rel="noopener noreferrer" // Good practice for security
                              className="cta-outline-small"
                              style={{ marginBottom: '5px', display: 'inline-block' }}
                            >
                              {/* Attempt to show a cleaner filename */}
                              {doc.includes('_') ? doc.split('_').slice(1).join('_') : doc}
                            </a>
                            <br />
                          </React.Fragment>
                        ))
                      ) : (
                        <span style={{ color: '#999' }}>N/A</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </>
        )}
      </div>
    </div>
  );
}

export default Applications;