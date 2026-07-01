const API_BASE = '/client/api';
const SHARED_API = '/api';

const getHeaders = () => {
  // Grab the secure CSRF token injected by Flask in the HTML <head>
  const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  
  return {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-CSRFToken': csrfToken // Send the token to get past Flask's security!
  };
};

// 1. Dashboard Stats & Profile
export const getClientDashboard = async () => {
  try {
    const response = await fetch(`${API_BASE}/dashboard`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch dashboard data');
    return await response.json();
  } catch (error) {
    console.error("Client API Error:", error);
    throw error;
  }
};

// 2. My Quotes & Requests
export const getMyQuotes = async () => {
  try {
    const response = await fetch(`${API_BASE}/my-quotes`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch quotes');
    return await response.json();
  } catch (error) {
    console.error("Client API Error:", error);
    return [];
  }
};

// 3. My Invoices
export const getMyInvoices = async () => {
  try {
    const response = await fetch(`${API_BASE}/my-invoices`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch invoices');
    return await response.json();
  } catch (error) {
    console.error("Client API Error:", error);
    return [];
  }
};

// 4. Payment Initialization (Shared)
export const initiateInvoicePayment = async (invoiceData) => {
    try {
        const response = await fetch(`${SHARED_API}/invoice/initiate-payment`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(invoiceData)
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Payment initiation failed');
        return result;
    } catch (error) {
        console.error("Payment API Error:", error);
        throw error;
    }
};

// 5. My Bookings
export const getMyBookings = async () => {
  try {
    const response = await fetch(`${API_BASE}/my-bookings`, {
      method: 'GET',
      headers: getHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch bookings');
    return await response.json();
  } catch (error) {
    console.error("Client API Error:", error);
    return [];
  }
};

// 6. Update Profile
export const updateClientProfile = async (profileData) => {
  try {
    const response = await fetch(`${API_BASE}/profile`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(profileData)
    });
    if (!response.ok) throw new Error('Failed to update profile');
    return await response.json();
  } catch (error) {
    console.error("Client API Error:", error);
    throw error;
  }
};

// 7. Download Quote PDF (The missing function causing the error)
export const downloadQuotePdf = async (quoteId, displayId) => {
    try {
        const response = await fetch(`${API_BASE}/quotes/${quoteId}/download`, {
            method: 'GET',
            headers: {
                'Accept': 'application/pdf'
            },
        });
        if (!response.ok) throw new Error('Failed to download PDF');
        
        // Handle Blob for download
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Quote_${displayId}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
    } catch (error) {
        console.error("Client API Error:", error);
        throw error;
    }
};

// 8. Accept/Reject Quote
export const respondToQuote = async (quoteId, action, additionalData = {}) => {
    try {
        const response = await fetch(`${API_BASE}/quotes/${quoteId}/respond`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ action, ...additionalData }) 
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to update quote');
        return result;
    } catch (error) {
        console.error("Client API Error:", error);
        throw error;
    }
};

// 9. Delete a Quote Request
export const deleteQuoteRequest = async (requestId) => {
    try {
        const response = await fetch(`${API_BASE}/requests/${requestId}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to delete request');
        return result;
    } catch (error) {
        console.error("Client API Error:", error);
        throw error;
    }
};

// 10. Edit a Quote Request
export const updateQuoteRequest = async (requestId, requestData) => {
    try {
        const response = await fetch(`${API_BASE}/requests/${requestId}`, {
            method: 'PUT',
            headers: getHeaders(),
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to update request');
        return result;
    } catch (error) {
        console.error("Client API Error:", error);
        throw error;
    }
};

// 11. Create Booking
export const createBooking = async (bookingData) => {
    try {
        const response = await fetch(`${API_BASE}/bookings`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify(bookingData)
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to create booking');
        return result;
    } catch (error) {
        console.error("Client API Error:", error);
        throw error;
    }
};

// 11b. Initiate Quick Book payment for a matched job (P1-3 endpoint).
// Returns { authorization_url } on success. Throws an Error whose `.status`
// carries the HTTP code — the modal uses 400 (no price set yet, BACKLOG #7) to
// render the clean "instant payment isn't available yet" terminal message
// rather than a raw error.
export const initiateQuickBookPayment = async (jobId) => {
    const response = await fetch(`${API_BASE}/jobs/${jobId}/initiate-payment`, {
        method: 'POST',
        headers: getHeaders()
    });
    const result = await response.json();
    if (!response.ok) {
        const err = new Error(result.message || 'Could not initialize payment');
        err.status = response.status;
        throw err;
    }
    return result;
};

// 11c. Public platform Quick Book catalogue for the discovery surface (F5).
// Ungated public read (no login/CSRF needed) — display-safe fields only.
export const getMarketplaceServices = async () => {
    try {
        const response = await fetch(`${SHARED_API}/marketplace/services`, { method: 'GET' });
        if (!response.ok) throw new Error('Failed to fetch services');
        return await response.json();
    } catch (error) {
        console.error("Client API Error:", error);
        return [];
    }
};

// 12. Create Custom Request (Handles Photo Uploads via FormData)
export const createCustomRequest = async (formData) => {
    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
        
        // Note: We deliberately OMIT the 'Content-Type' header here. 
        // The browser will automatically set it to 'multipart/form-data' with the correct boundary.
        const response = await fetch(`${API_BASE}/requests/custom`, {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'X-CSRFToken': csrfToken
            },
            body: formData
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to submit request');
        return result;
    } catch (error) {
        console.error("Client API Error:", error);
        throw error;
    }
};