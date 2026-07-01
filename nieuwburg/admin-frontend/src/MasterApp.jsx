import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MasterCatalog from './pages/master/MasterCatalog';

// Master-admin (platform) area routes (F3). Kept separate from App.jsx so the
// platform area stays cleanly distinct from the tenant admin/client portals.
// F3a ships the read-only catalogue; F6 will grow this into the full platform area.
export default function MasterApp() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/catalogue" replace />} />
      <Route path="/catalogue" element={<MasterCatalog />} />
      <Route path="*" element={<Navigate to="/catalogue" replace />} />
    </Routes>
  );
}
