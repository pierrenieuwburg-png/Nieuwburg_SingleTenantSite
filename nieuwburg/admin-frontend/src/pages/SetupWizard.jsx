import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarLoader } from 'react-spinners';

// Helper component for a single step
const WizardStep = ({ children, isActive }) => {
    return isActive ? <div className="wizard-step">{children}</div> : null;
};

function SetupWizard() {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState(null);
    const [csrfToken, setCsrfToken] = useState("");
    const navigate = useNavigate();

    // This state will hold all our form data
    const [formData, setFormData] = useState({
        business_name: '',
        business_address: '',
        registration_number: '',
        default_terms: '1. All payments are due within 30 days.\n2. ...',
    });

    // 1. Get CSRF token and load existing data on mount
    useEffect(() => {
        const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
        setCsrfToken(token || "");

        const fetchSettings = async () => {
            setIsLoading(true);
            try {
                // We fetch existing settings in case they pre-filled their business name
                const response = await fetch('/api/admin/business-settings');
                if (!response.ok) throw new Error('Failed to load business data.');
                const data = await response.json();
                
                // Pre-fill the form with any data we already have
                setFormData(prev => ({
                    ...prev,
                    business_name: data.business_name || '',
                    business_address: data.business_address || '',
                    registration_number: data.registration_number || '',
                    default_terms: data.default_terms || '1. All payments are due within 30 days.\n2. ...'
                }));
            } catch (err) {
                setError(err.message);
            } finally {
                setIsLoading(false);
            }
        };
        fetchSettings();
    }, []);

    // 2. Handle form field changes
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // 3. Handle final submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setError(null);

        if (!csrfToken) {
            setError("A configuration error occurred. Please refresh and try again.");
            setIsSaving(false);
            return;
        }

        try {
            // We will create this API endpoint in the next step
            const response = await fetch('/api/admin/setup-wizard/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrfToken
                },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Failed to save settings.');

            // Success! Redirect to the main dashboard.
            navigate('/admin/dashboard');

        } catch (err) {
            setError(err.message);
            setIsSaving(false); // Stay on page to show error
        }
    };

    if (isLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>
                <BarLoader color="#006ac6" width="50%" />
            </div>
        );
    }

    // This is the JSX for the wizard component
    return (
        <div style={{ maxWidth: '700px', margin: '40px auto', backgroundColor: '#fff', padding: '30px', borderRadius: '8px', border: '1.5px solid #e5e7eb' }}>
            
            <h1 style={{ fontFamily: "'Oswald', sans-serif", color: '#002244', textAlign: 'center', marginTop: 0 }}>
                Welcome to Nieuwburg Blitz!
            </h1>
            <p style={{ textAlign: 'center', fontSize: '1.1rem', color: '#6b7280', marginTop: '-10px', marginBottom: '30px' }}>
                Let's get your business set up in just a few steps.
            </p>

            {error && (
                <div className="flash error" style={{ marginBottom: '20px' }}>
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                {/* --- STEP 1: General Info --- */}
                <WizardStep isActive={step === 1}>
                    <h2 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Step 1: Your Business Details</h2>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                        <label htmlFor="business_name" className="form-label">Business Name</label>
                        <input
                            type="text" id="business_name" name="business_name"
                            className="form-input"
                            value={formData.business_name}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                        <label htmlFor="business_address" className="form-label">Business Address</label>
                        <input
                            type="text" id="business_address" name="business_address"
                            className="form-input"
                            value={formData.business_address}
                            onChange={handleChange}
                            placeholder="e.g. 123 Main St, Cape Town, 8001"
                        />
                    </div>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                        <label htmlFor="registration_number" className="form-label">Registration Number (Optional)</label>
                        <input
                            type="text" id="registration_number" name="registration_number"
                            className="form-input"
                            value={formData.registration_number}
                            onChange={handleChange}
                        />
                    </div>
                    <div style={{ textAlign: 'right', marginTop: '30px' }}>
                        <button type="button" className="cta" onClick={() => setStep(2)}>
                            Next: Quoting Terms &rarr;
                        </button>
                    </div>
                </WizardStep>

                {/* --- STEP 2: Quoting Terms --- */}
                <WizardStep isActive={step === 2}>
                    <h2 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Step 2: Default Quoting Terms</h2>
                    <p style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '-10px' }}>
                        This is your default terms and conditions text that will be added to every new quote. You can edit this later.
                    </p>
                    <div className="form-group" style={{ marginBottom: '15px' }}>
                        <label htmlFor="default_terms" className="form-label">Terms & Conditions</label>
                        <textarea
                            id="default_terms" name="default_terms"
                            className="form-input"
                            value={formData.default_terms}
                            onChange={handleChange}
                            rows={12}
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px' }}>
                        <button type="button" className="cta-outline" onClick={() => setStep(1)}>
                            &larr; Back
                        </button>
                        <button type="submit" className="cta" disabled={isSaving}>
                            {isSaving ? 'Saving...' : 'Finish Setup'}
                        </button>
                    </div>
                </WizardStep>
            </form>
        </div>
    );
}

export default SetupWizard;