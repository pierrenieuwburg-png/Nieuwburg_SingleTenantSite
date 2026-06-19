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

  const formatPrice = (item) => {
    const rate = `R${item.default_rate?.toFixed(2) || '0.00'}`;
    const prefix = item.is_variable_price ? 'From ' : '';
    
    if (item.pricing_type === 'hourly') return `${prefix}${rate} /hr`;
    if (item.pricing_type === 'sqm') return `${prefix}${rate} /m²`;
    return `${prefix}${rate}`;
  };

  const getFlowLabel = (method) => {
    switch(method) {
        case 'hourly': return 'Time Block (Hourly)';
        case 'a_la_carte': return 'A La Carte (Shopping Cart)';
        case 'lead_gen': return 'Custom Quote (Lead Gen)';
        default: return 'Base Scope + Extras';
    }
  };

  return (
    <div className="page-container">
      <div className="admin-header">
        <h1>Services & Pricing</h1>
        <button className="cta" onClick={() => setShowCatModal(true)}>+ Add Category</button>
      </div>

      {isLoading ? <BarLoader color="#006ac6" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {categories.map(cat => {
                const primaryItems = cat.items ? cat.items.filter(i => !i.is_extra) : [];
                const extraItems = cat.items ? cat.items.filter(i => i.is_extra) : [];

                return (
                <div key={cat.id} style={{ background: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                    {/* Category Header */}
                    <div style={{ padding: '15px 20px', background: '#f3f4f6', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#1f2937' }}>{cat.name}</h3>
                            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <span style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                                    <strong style={{color: '#111827'}}>Master Flow:</strong> {getFlowLabel(cat.calculation_method)}
                                </span>
                                <span style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                                    <strong style={{color: '#111827'}}>Client Prompt:</strong> "{cat.prompt_question || 'What service do you require?'}"
                                </span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button onClick={() => handleDeleteCategory(cat.id)} style={{ color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>Delete</button>
                            <button className="cta-outline" style={{ padding: '5px 10px', fontSize: '0.85rem' }} onClick={() => {
                                setTargetCatId(cat.id);
                                setServiceToEdit(null);
                                setShowServiceModal(true);
                            }}>+ Add Item</button>
                        </div>
                    </div>

                    {/* Table Render Logic */}
                    {cat.items && cat.items.length > 0 ? (
                        <div style={{ padding: '0' }}>
                            
                            {/* PRIMARY SCOPE TABLE */}
                            {primaryItems.length > 0 && (
                                <div>
                                    <div style={{ padding: '8px 20px', background: '#e0f2fe', color: '#0369a1', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        Primary Scope Items
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <tbody>
                                            {primaryItems.map(item => (
                                                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                                    <td style={{ padding: '12px 20px', fontWeight: 500, width: '40%' }}>{item.name}</td>
                                                    <td style={{ padding: '12px 20px', textTransform: 'capitalize', width: '20%' }}>{item.pricing_type || 'Fixed'}</td>
                                                    <td style={{ padding: '12px 20px', fontWeight: 600, color: '#059669', width: '20%' }}>{formatPrice(item)}</td>
                                                    <td style={{ padding: '12px 20px', textAlign: 'right', width: '20%' }}>
                                                        <button style={{ marginRight: '15px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }} onClick={() => { setServiceToEdit(item); setShowServiceModal(true); }}>Edit</button>
                                                        <button style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => handleDeleteItem(item.id)}>Delete</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            {/* EXTRAS TABLE */}
                            {extraItems.length > 0 && (
                                <div>
                                    <div style={{ padding: '8px 20px', background: '#fce7f3', color: '#be185d', fontSize: '0.85rem', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.5px', borderTop: primaryItems.length > 0 ? '1px solid #e5e7eb' : 'none' }}>
                                        Additional Extras (Add-ons)
                                    </div>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <tbody>
                                            {extraItems.map(item => (
                                                <tr key={item.id} style={{ borderBottom: '1px solid #f3f4f6', background: '#fffbfb' }}>
                                                    <td style={{ padding: '12px 20px', fontWeight: 500, width: '40%' }}>{item.name}</td>
                                                    <td style={{ padding: '12px 20px', textTransform: 'capitalize', width: '20%' }}>{item.pricing_type || 'Fixed'}</td>
                                                    <td style={{ padding: '12px 20px', fontWeight: 600, color: '#059669', width: '20%' }}>{formatPrice(item)}</td>
                                                    <td style={{ padding: '12px 20px', textAlign: 'right', width: '20%' }}>
                                                        <button style={{ marginRight: '15px', color: '#3b82f6', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500 }} onClick={() => { setServiceToEdit(item); setShowServiceModal(true); }}>Edit</button>
                                                        <button style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }} onClick={() => handleDeleteItem(item.id)}>Delete</button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                        </div>
                    ) : (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#9ca3af' }}>No services in this category yet.</div>
                    )}
                </div>
            )})}
        </div>
      )}

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