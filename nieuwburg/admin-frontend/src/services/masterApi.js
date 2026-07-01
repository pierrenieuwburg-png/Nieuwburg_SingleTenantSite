// Master-admin (platform) API helpers (F3).
// The master blueprint is NOT csrf-exempt, so mutations must send X-CSRFToken
// (from the csrf-token meta). F3a is read-only; the csrf helper is here ready
// for F3b's create/edit/delete.

const csrfToken = () =>
  document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';

export async function listServices() {
  const res = await fetch('/master-admin/api/services');
  if (!res.ok) throw new Error('Failed to load the catalogue.');
  return res.json();
}

export async function getService(id) {
  const res = await fetch(`/master-admin/api/services/${id}`);
  if (!res.ok) throw new Error('Failed to load the service.');
  return res.json();
}

// Exposed for F3b mutation helpers.
export { csrfToken };
