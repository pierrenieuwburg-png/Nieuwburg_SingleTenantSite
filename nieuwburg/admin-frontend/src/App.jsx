import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';

// Admin Components
import Dashboard from './pages/Dashboard';
import Applications from './pages/Applications';
import Bookings from './pages/Bookings';
import Clients from './pages/Clients';
import Staff from './pages/Staff';
import Quotes from './pages/Quotes';
import Invoices from './pages/Invoices';
import Services from './pages/Services';
import Blog from './pages/Blog';
import ActivityLog from './pages/ActivityLog';
import ClientDetail from './pages/ClientDetail';
import StaffDetail from './pages/StaffDetail';
import EditStaff from './pages/EditStaff';
import EditClient from './pages/EditClient';
import QuoteDetail from './pages/QuoteDetail';
import CreateQuote from './pages/CreateQuote';
import FormalQuoteDetail from './pages/FormalQuoteDetail';
import EditQuote from './pages/EditQuote';
import BusinessSettings from './pages/BusinessSettings';
import SetupWizard from './pages/SetupWizard';
import ClientPayments from './pages/client/ClientPayments';
import ClientQuotes from './pages/client/ClientQuotes';
import GuestSuccessToast from './components/GuestSuccessToast';
import StaffJobExecution from './pages/StaffJobExecution';

// --- NEW CLIENT IMPORTS ---
import ClientLayout from './layouts/ClientLayout';
import ClientHome from './pages/client/ClientHome';

// --- MARKETPLACE IMPORT ---
import ProviderDispatchModal from './components/ProviderDispatchModal';

// Placeholder for future client pages (Bookings, Profile, etc.)
const Placeholder = ({ title }) => (
  <div style={{ padding: '3rem', textAlign: 'center', color: '#6b7280' }}>
    <h2 style={{ marginBottom: '1rem', color: '#1f2937' }}>{title}</h2>
    <p>This feature is coming in the next update.</p>
  </div>
);

// Placeholder for unmatched routes
const NotFound = () => <div style={{ padding: '2rem' }}><h2>Page Not Found</h2></div>;

function App() {
  const [currentTenantId, setCurrentTenantId] = useState(null);

  // Fetch the current user/tenant context when the app loads
  useEffect(() => {
    const fetchUserContext = async () => {
      try {
        // We will hit a lightweight endpoint to grab the tenant ID
        const res = await fetch('/api/user/me'); 
        if (res.ok) {
          const userData = await res.json();
          // Only set the tenant ID if the user is a logged-in admin/provider
          if (userData.role === 'admin' && userData.tenant_id) {
            setCurrentTenantId(userData.tenant_id); 
          }
        }
      } catch (err) {
        console.error("Failed to load user context for marketplace routing", err);
      }
    };
    fetchUserContext();
  }, []);

  return (
    <>
      {/* GLOBAL COMPONENTS: 
        These sit outside the router so they can slide in over ANY page.
      */}
      <GuestSuccessToast />
      
      {/* 🚨 THE UBER-STYLE DISPATCH ENGINE NOTIFICATION 🚨 */}
      {currentTenantId && <ProviderDispatchModal tenantId={currentTenantId} />}

      <Routes>
        {/* =========================================
            ADMIN ROUTES 
           ========================================= */}
        <Route path="/" element={<Dashboard />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/clients" element={<Clients />} />
        <Route path="/clients/:clientId" element={<ClientDetail />} />
        <Route path="/client/edit/:clientId" element={<EditClient />} />
        <Route path="/staff" element={<Staff />} />
        <Route path="/staff/:staffId" element={<StaffDetail />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="services" element={<Services />} />
        <Route path="/staff/edit/:staffId" element={<EditStaff />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="/quotes" element={<Quotes />} />
        <Route path="/quotes/new" element={<CreateQuote />} />
        <Route path="/quotes/:quoteId" element={<QuoteDetail />} />
        <Route path="/invoices" element={<Invoices />} />
        <Route path="/services" element={<Services />} />
        <Route path="/blog" element={<Blog />} />
        <Route path="/activity-log" element={<ActivityLog />} />
        <Route path="/quotes/formal/:quoteId" element={<FormalQuoteDetail />} />
        <Route path="/quotes/edit/:quoteId" element={<EditQuote />} />
        <Route path="/settings" element={<BusinessSettings />} />
        <Route path="/setup-wizard" element={<SetupWizard />} />
        <Route path="/job/:jobId" element={<StaffJobExecution />} />
        <Route path="/staff-app/job/:jobId" element={<StaffJobExecution />} />

        {/* =========================================
            CLIENT PORTAL ROUTES (New Layout)
           ========================================= */}
        <Route path="/client/dashboard" element={<ClientLayout />}>
          
          {/* Index matches exactly "/client/dashboard" */}
          <Route index element={<ClientHome />} />
          
          {/* Sub-routes match "/client/dashboard/profile", etc. */}
          <Route path="profile" element={<Placeholder title="My Profile" />} />
          <Route path="bookings" element={<Placeholder title="My Bookings" />} />
          <Route path="partners" element={<Placeholder title="BlitzPartners" />} />
          <Route path="locations" element={<Placeholder title="My Locations" />} />
          <Route path="payments" element={<ClientPayments />} />
          <Route path="rewards" element={<Placeholder title="BlitzCoins & Rewards" />} />
          <Route path="vouchers" element={<Placeholder title="Vouchers" />} />
          <Route path="quotes" element={<ClientQuotes />} />
          
        </Route>

        {/* Fallback */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;