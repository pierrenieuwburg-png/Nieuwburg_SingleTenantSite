import React, { useState, useEffect } from 'react';
import { BarLoader } from 'react-spinners';
import ServiceModal from '../components/ServiceModal';
import CategoryModal from '../components/CategoryModal';

function Services() {
  const [categories, setCategories] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [csrfToken, setCsrfToken] = useState("");
  
  // Modal State
  const [showCatModal, setShowCatModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceToEdit, setServiceToEdit] = useState(null);
  const [targetCatId, setTargetCatId] = useState(null);

  const fetchServices = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/service-categories');
      const data = await res.json();
      setCategories(data);
    } catch (error) {
      console.error("Error loading services:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
    setCsrfToken(token || "");
    fetchServices();
  }, []);

  const handleDeleteCategory = async (id) => {
    if (!window.confirm("Delete this category? All items inside it will also be deleted.")) return;
    try {
        await fetch(`/api/admin/service-categories/${id}`, { 
            method: 'DELETE', headers: {'X-CSRFToken': csrfToken} 
        });
        fetchServices();
    } catch (e) { alert("Error deleting category"); }
  };

  const handleDeleteItem = async (id) => {
    if (!window.confirm("Delete this service item?")) return;
    try {
        await fetch(`/api/admin/service-items/${id}`, { 
            method: 'DELETE', headers: {'X-CSRFToken': csrfToken} 
        });
        fetchServices();
    } catch (e) { alert("Error deleting item"); }
  };

  // Helper to display price nicely
  const formatPrice = (item) => {
    const rate = `R${item.default_rate?.toFixed(2) || '0.00'}`;
    const prefix = item.is_variable_price ? 'From ' : '';
    
    if (item.pricing_type === 'hourly') return `${prefix}${rate} /hr`;
    if (item.pricing_type === 'sqm') return `${prefix}${rate} /m²`;
    return `${prefix}${rate}`;
  };

  return (
    <div className="page-container">
      <div className="admin-header">
        <h1>Services & Pricing</h1>
        <button className="cta" onClick={() => setShowCatModal(true)}>+ Add Category</button>
      </div>

      {isLoading ? <BarLoader color="#006ac6" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {categories.map(cat => (
                <div key={cat.id} style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    {/* Category Header */}
                    <div style={{ padding: '15px 20px', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#1f2937' }}>{cat.name}</h3>
                            {cat.description && <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>{cat.description}</span>}
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => handleDeleteCategory(cat.id)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>Delete Category</button>
                            <button className="cta-outline" style={{ padding: '5px 10px', fontSize: '0.85rem' }} onClick={() => {
                                setTargetCatId(cat.id);
                                setServiceToEdit(null);
                                setShowServiceModal(true);
                            }}>+ Add Item</button>
                        </div>
                    </div>

                    {/* Items List */}
                    <div style={{ padding: '0' }}>
                        {cat.items && cat.items.length > 0 ? (
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr style={{ background: '#f9fafb', textAlign: 'left', fontSize: '0.85rem', color: '#6b7280' }}>
                                        <th style={{ padding: '10px 20px' }}>Service Name</th>
                                        <th style={{ padding: '10px 20px' }}>Type</th>
                                        <th style={{ padding: '10px 20px' }}>Rate</th>
                                        <th style={{ padding: '10px 20px' }}>Est. Time</th>
                                        <th style={{ padding: '10px 20px', textAlign: 'right' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cat.items.map(item => (
                                        <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                            <td style={{ padding: '12px 20px', fontWeight: 500 }}>
                                                {item.name}
                                                {item.is_material && <span style={{ marginLeft: '8px', fontSize: '0.7rem', background: '#fff7ed', color: '#c2410c', padding: '2px 6px', borderRadius: '4px', border: '1px solid #ffedd5' }}>MATERIAL</span>}
                                            </td>
                                            <td style={{ padding: '12px 20px', textTransform: 'capitalize' }}>{item.pricing_type || 'Fixed'}</td>
                                            <td style={{ padding: '12px 20px', fontWeight: 600, color: '#059669' }}>{formatPrice(item)}</td>
                                            <td style={{ padding: '12px 20px' }}>{item.estimated_time_mins} min</td>
                                            <td style={{ padding: '12px 20px', textAlign: 'right' }}>
                                                <button style={{ marginRight: '15px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }} 
                                                    onClick={() => {
                                                        setServiceToEdit(item);
                                                        setShowServiceModal(true);
                                                    }}>Edit</button>
                                                <button style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }} 
                                                    onClick={() => handleDeleteItem(item.id)}>Delete</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        ) : (
                            <div style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>No services in this category yet.</div>
                        )}
                    </div>
                </div>
            ))}
        </div>
      )}

      {/* Modals */}
      <ServiceModal 
        isOpen={showServiceModal} 
        onClose={() => setShowServiceModal(false)} 
        onSuccess={() => { setShowServiceModal(false); fetchServices(); }}
        serviceToEdit={serviceToEdit}
        initialCategoryId={targetCatId}
      />

      <CategoryModal 
        isOpen={showCatModal} 
        onClose={() => setShowCatModal(false)} 
        onSuccess={() => { setShowCatModal(false); fetchServices(); }}
      />
    </div>
  );
}

export default Services;