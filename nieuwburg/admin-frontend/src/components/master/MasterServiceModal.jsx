import React, { useState, useEffect } from 'react';
import { createService, updateService } from '../../services/masterApi';

const ALLOWED_FREQUENCIES = ['Once-off', 'Weekly', 'Bi-Weekly', 'Monthly'];

// F3b: create/edit a Quick Book catalogue item. `service` = null -> create.
function MasterServiceModal({ isOpen, service, onClose, onSaved }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [isQuickBookable, setIsQuickBookable] = useState(false);
  const [pricingMode, setPricingMode] = useState('flat');
  const [flatPrice, setFlatPrice] = useState('');
  const [rows, setRows] = useState([{ frequency: 'Once-off', price: '' }]);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (service) {
      setName(service.name || '');
      setCategory(service.category || '');
      setIsActive(!!service.is_active);
      setIsQuickBookable(!!service.is_quick_bookable);
      setPricingMode(service.pricing_mode || 'flat');
      setFlatPrice(service.flat_price != null ? String(service.flat_price) : '');
      setRows(
        service.prices && service.prices.length
          ? service.prices.map((p) => ({ frequency: p.frequency, price: String(p.price) }))
          : [{ frequency: 'Once-off', price: '' }]
      );
    } else {
      setName(''); setCategory(''); setIsActive(true);
      setIsQuickBookable(false); setPricingMode('flat'); setFlatPrice('');
      setRows([{ frequency: 'Once-off', price: '' }]);
    }
  }, [isOpen, service]);

  if (!isOpen) return null;

  const updateRow = (i, field, value) =>
    setRows(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const addRow = () => setRows([...rows, { frequency: '', price: '' }]);
  const removeRow = (i) => setRows(rows.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const payload = {
      name,
      category,
      is_active: isActive,
      is_quick_bookable: isQuickBookable,
    };
    if (isQuickBookable) {
      payload.pricing_mode = pricingMode;
      if (pricingMode === 'flat') {
        payload.flat_price = parseFloat(flatPrice);
      } else {
        payload.prices = rows.map((r) => ({ frequency: r.frequency, price: parseFloat(r.price) }));
      }
    }
    setSaving(true);
    try {
      const saved = service
        ? await updateService(service.id, payload)
        : await createService(payload);
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay simple-modal" style={{ display: 'flex' }}>
      <div className="modal-content auth-modal-content" style={{ maxWidth: 560 }}>
        <button className="modal-close" aria-label="Close" onClick={onClose}>&times;</button>
        <h2 className="auth-title">{service ? 'Edit' : 'New'} Quick Book Item</h2>

        {error && <div className="flash error" style={{ marginTop: 0 }}>{error}</div>}

        <form className="profile-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Name</label>
            <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Category (optional)</label>
            <input className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} />
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="svc-active" checked={isActive}
                   onChange={(e) => setIsActive(e.target.checked)} style={{ width: 18, height: 18 }} />
            <label htmlFor="svc-active" style={{ marginBottom: 0 }}>Active</label>
          </div>

          <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="svc-qb" checked={isQuickBookable}
                   onChange={(e) => setIsQuickBookable(e.target.checked)} style={{ width: 18, height: 18 }} />
            <label htmlFor="svc-qb" style={{ marginBottom: 0 }}>Quick-Bookable (priced &amp; instantly bookable)</label>
          </div>

          {isQuickBookable && (
            <>
              <div className="form-group">
                <label className="form-label">Pricing mode</label>
                <select className="form-control" value={pricingMode}
                        onChange={(e) => setPricingMode(e.target.value)}>
                  <option value="flat">Flat (one-off)</option>
                  <option value="frequency">Frequency-based</option>
                </select>
              </div>

              {pricingMode === 'flat' ? (
                <div className="form-group">
                  <label className="form-label">Flat price (R)</label>
                  <input className="form-control" type="number" min="0" step="0.01"
                         value={flatPrice} onChange={(e) => setFlatPrice(e.target.value)} />
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label">Frequency prices</label>
                  {rows.map((r, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <select className="form-control" value={r.frequency}
                              onChange={(e) => updateRow(i, 'frequency', e.target.value)}>
                        <option value="">— frequency —</option>
                        {ALLOWED_FREQUENCIES.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                      <input className="form-control" type="number" min="0" step="0.01" placeholder="Price (R)"
                             value={r.price} onChange={(e) => updateRow(i, 'price', e.target.value)} />
                      <button type="button" className="icon-btn delete-btn" title="Remove"
                              onClick={() => removeRow(i)}>&times;</button>
                    </div>
                  ))}
                  <button type="button" className="cta-outline-small" onClick={addRow}>+ Add frequency</button>
                </div>
              )}
            </>
          )}

          <button type="submit" className="cta" disabled={saving}>
            {saving ? 'Saving…' : (service ? 'Save changes' : 'Create item')}
          </button>
        </form>
      </div>
    </div>
  );
}

export default MasterServiceModal;
