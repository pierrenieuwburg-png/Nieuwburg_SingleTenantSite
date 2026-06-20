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

// 8. Accept/Reject Quote (The other missing function)
export const respondToQuote = async (quoteId, action) => {
    try {
        const response = await fetch(`${API_BASE}/quotes/${quoteId}/respond`, {
            method: 'POST',
            headers: getHeaders(),
            body: JSON.stringify({ action }) 
        });
        
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Failed to update quote');
        return result;
    } catch (error) {
        console.error("Client API Error:", error);
        throw error;
    }
};

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