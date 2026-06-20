import React, { useState, useEffect } from 'react';

const GuestSuccessToast = () => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        // Check the URL for the success parameters
        const urlParams = new URLSearchParams(window.location.search);
        const isSuccess = urlParams.get('booking_success');
        const isNewUser = urlParams.get('new_user');

        if (isSuccess === 'true' && isNewUser === 'true') {
            // Slight delay so it slides in dynamically after the page loads
            setTimeout(() => {
                setShow(true);
            }, 800);

            // Clean up the URL so it doesn't show again if they refresh the page
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }, []);

    if (!show) return null;

    return (
        <>
            {/* Embedded CSS for the slide-in animation */}
            <style>{`
                .guest-success-toast {
                    position: fixed;
                    bottom: 30px;
                    right: -400px; /* Start off-screen */
                    width: 350px;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2);
                    padding: 24px;
                    z-index: 99999;
                    border-left: 6px solid #10b981; /* Success Green */
                    transition: right 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }
                .guest-success-toast.show {
                    right: 30px; /* Slide in to view */
                }
            `}</style>

            <div className={`guest-success-toast ${show ? 'show' : ''}`}>
                <h3 style={{ margin: '0 0 10px 0', color: '#111827', fontSize: '1.2rem' }}>
                    🎉 Booking Confirmed!
                </h3>
                <p style={{ color: '#4b5563', fontSize: '0.95rem', lineHeight: '1.5', margin: '0 0 15px 0' }}>
                    Your space is about to sparkle. 
                    We’ve sent a magic link to your email—click it to set your password, view your live booking tracker, and start managing your home like a pro.
                </p>
                <button 
                    style={{ 
                        background: '#006ac6', color: 'white', width: '100%', 
                        padding: '10px', border: 'none', borderRadius: '8px', 
                        fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s'
                    }}
                    onMouseOver={(e) => e.target.style.background = '#0058a3'}
                    onMouseOut={(e) => e.target.style.background = '#006ac6'}
                    onClick={() => setShow(false)}
                >
                    Got it, I'll check my email!
                </button>
            </div>
        </>
    );
};

export default GuestSuccessToast;