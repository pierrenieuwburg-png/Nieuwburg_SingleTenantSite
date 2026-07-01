import React, { useState, useEffect } from 'react';
import { BarLoader } from 'react-spinners';
import { listServices, deleteService, toggleActive } from '../../services/masterApi';
import MasterServiceModal from '../../components/master/MasterServiceModal';

// Quick Book catalogue: list + create/edit modal + activate/deactivate + delete (F3b).
function MasterCatalog() {
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const refresh = () =>
    listServices().then(setServices).catch((err) => setError(err.message));

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, []);

  const openCreate = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (svc) => { setEditing(svc); setModalOpen(true); };
  const onSaved = () => { setModalOpen(false); setEditing(null); refresh(); };

  const handleToggle = async (svc) => {
    try { await toggleActive(svc.id); refresh(); }
    catch (err) { alert(err.message); }
  };

  const handleDelete = async (svc) => {
    if (!window.confirm(`Delete "${svc.name}"? This cannot be undone.`)) return;
    try { await deleteService(svc.id); refresh(); }
    catch (err) { alert(err.message); }  // 409 "used by jobs — deactivate instead"
  };

  const priceSummary = (svc) => {
    if (svc.pricing_mode === 'flat') {
      return svc.flat_price != null ? `R${svc.flat_price.toFixed(2)} (flat)` : '—';
    }
    if (svc.pricing_mode === 'frequency') {
      const rows = svc.prices || [];
      if (rows.length === 0) return '— (no rows)';
      return rows.map((p) => `${p.frequency}: R${p.price.toFixed(2)}`).join(', ');
    }
    return '—';
  };

  const query = searchTerm.trim().toLowerCase();
  const filtered = query
    ? services.filter((s) =>
        (s.name || '').toLowerCase().includes(query) ||
        (s.category || '').toLowerCase().includes(query) ||
        (s.pricing_mode || '').toLowerCase().includes(query)
      )
    : services;

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
        <BarLoader color="#006ac6" width="50%" />
      </div>
    );
  }

  return (
    <div>
      <div className="admin-header">
        <h1>Quick Book Catalogue</h1>
        <button className="cta" onClick={openCreate}>New Item</button>
      </div>

      {error && <p className="error-message">{error}</p>}

      {!error && services.length === 0 ? (
        <div className="empty-state">
          <p>No catalogue items yet.</p>
        </div>
      ) : (
        <>
        <div className="form-group" style={{ marginBottom: '20px', maxWidth: '400px' }}>
          <label htmlFor="catalogue-search" className="form-label">Search Catalogue</label>
          <input
            type="text"
            id="catalogue-search"
            className="form-control"
            placeholder="Search by name, category, or mode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Category</th>
                <th>Quick-Bookable</th>
                <th>Mode</th>
                <th>Price</th>
                <th>Active</th>
                <th>Review</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '20px' }}>
                    No items match your search.
                  </td>
                </tr>
              ) : filtered.map((svc) => (
                <tr key={svc.id}>
                  <td style={{ fontWeight: 600, color: '#002244' }}>{svc.name}</td>
                  <td>{svc.category || '—'}</td>
                  <td>{svc.is_quick_bookable ? 'Yes' : 'No'}</td>
                  <td>{svc.pricing_mode || '—'}</td>
                  <td>{priceSummary(svc)}</td>
                  <td>{svc.is_active ? 'Active' : 'Inactive'}</td>
                  <td>
                    <span className="status-badge" data-status={svc.review_status}>
                      {svc.review_status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <button className="cta-outline-small" onClick={() => openEdit(svc)}>Edit</button>
                    {' '}
                    <button className="cta-outline-small" onClick={() => handleToggle(svc)}>
                      {svc.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    {' '}
                    <button className="icon-btn delete-btn" title="Delete" onClick={() => handleDelete(svc)}>
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      <MasterServiceModal
        isOpen={modalOpen}
        service={editing}
        onClose={() => { setModalOpen(false); setEditing(null); }}
        onSaved={onSaved}
      />
    </div>
  );
}

export default MasterCatalog;
