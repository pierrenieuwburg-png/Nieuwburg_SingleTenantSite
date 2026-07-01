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

// Mutations (F3b). Send X-CSRFToken — the master blueprint is NOT csrf-exempt.
async function mutate(url, method, body) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken() },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'Request failed.');
    err.status = res.status;
    throw err;
  }
  return data;
}

export const createService = (body) => mutate('/master-admin/api/services', 'POST', body);
export const updateService = (id, body) => mutate(`/master-admin/api/services/${id}`, 'PUT', body);
export const deleteService = (id) => mutate(`/master-admin/api/services/${id}`, 'DELETE');
export const toggleActive = (id) => mutate(`/master-admin/api/services/${id}/toggle-active`, 'POST');

export { csrfToken };
