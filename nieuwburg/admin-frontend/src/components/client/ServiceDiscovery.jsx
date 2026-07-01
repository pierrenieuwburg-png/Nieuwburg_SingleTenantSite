import React, { useState, useEffect } from 'react';
import { FaBroom, FaTree, FaTools, FaHome, FaArrowRight } from 'react-icons/fa';
import { getMarketplaceServices } from '../../services/clientApi';

// F5: "What service do you need?" discovery tiles, driven by the platform
// MarketplaceService catalogue (active + approved only). A display surface — it
// does NOT book/quote; it calls onSelect(item) and ClientHome routes the item to
// the existing ClientBookingModal (quick-bookable) or CustomRequestModal (quote).
const ICONS = { cleaning: FaBroom, gardening: FaTree, maintenance: FaTools };
const iconFor = (svc) => {
  const key = (svc.category || svc.name || '').toLowerCase();
  return ICONS[key] || FaHome;
};

const ServiceDiscovery = ({ onSelect }) => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMarketplaceServices()
      .then(setServices)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="service-dock-section">
        <h2 className="section-heading">What service do you need?</h2>
        <p style={{ color: '#666' }}>Loading services…</p>
      </section>
    );
  }

  if (services.length === 0) {
    return (
      <section className="service-dock-section">
        <h2 className="section-heading">What service do you need?</h2>
        <p style={{ color: '#666' }}>No services available right now — please check back soon.</p>
      </section>
    );
  }

  return (
    <section className="service-dock-section">
      <h2 className="section-heading">What service do you need?</h2>
      <div className="service-dock">
        {services.map((svc) => {
          const Icon = iconFor(svc);
          return (
            <button key={svc.name} className="service-card" onClick={() => onSelect(svc)}>
              <div className="icon-box clean"><Icon /></div>
              <span>{svc.name}</span>
              <small style={{ color: '#666' }}>
                {svc.is_quick_bookable
                  ? (svc.price_display || 'Book now')
                  : <>Get a quote <FaArrowRight size={10} /></>}
              </small>
            </button>
          );
        })}
      </div>
    </section>
  );
};

export default ServiceDiscovery;
