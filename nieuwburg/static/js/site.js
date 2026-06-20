// --- GLOBAL VARIABLES ---
let masterTimeline;
let mapInitialized = false;
const serviceDetails = {
  residential: {
    title: 'Residential Cleaning',
    content: `<p>Our residential cleaning service is designed to give you the peace of mind you deserve and the time you need to enjoy your life. We offer flexible scheduling for weekly, bi-weekly, or monthly visits.</p><ul><li>Kitchens (counters, floors, appliances)</li><li>Bathrooms (toilets, showers, sinks)</li><li>Living areas (dusting, vacuuming, mopping)</li><li>Bedrooms (making beds, dusting, floors)</li></ul>`
  },
  commercial: {
    title: 'Office Cleaning',
    content: `<p>A clean, professional workspace boosts productivity and creates a welcoming atmosphere for your clients. We provide reliable and efficient cleaning services for offices of all sizes.</p><ul><li>Desk & workstation sanitation</li><li>Restroom cleaning and stocking</li><li>Trash removal and recycling</li><li>Floor care and vacuuming</li><li>Breakroom and kitchen cleaning</li></ul>`
  },
  deep: {
    title: 'Deep Blitz Cleaning',
    content: `<p>Our deep cleaning service is a comprehensive, top-to-bottom clean. It's perfect for a seasonal spring clean or for preparing your home for a special event. We tackle the details that are often overlooked.</p><ul><li>Scrubbing grout and tiles</li><li>Cleaning inside ovens and refrigerators</li><li>Washing baseboards, doors, and window frames</li><li>Detailed dusting including light fixtures and vents</li></ul>`
  },
  tenancy: {
    title: 'Move-in / Move-out Cleaning',
    content: `<p>Specializing in end-of-tenancy cleaning, we work with tenants, landlords, and agencies to ensure properties are immaculate for the next occupants. Our blitz cleaning approach guarantees a fast turnaround without compromising on quality, helping you secure your deposit or prepare your property for rent.</p><ul><li>Full property cleaning to agency standards</li><li>Carpet and upholstery cleaning add-ons</li><li>Guaranteed to pass inspection</li><li>Fast and efficient team for quick turnarounds</li></ul>`
  }
};

// --- PASSWORD VALIDATOR FUNCTION ---
function initializePasswordValidator() {
    const passInput = document.getElementById('reg-password') || document.getElementById('register-password');
    const confirmPassInput = document.getElementById('reg-password-confirm') || document.getElementById('register-confirm-password');
    
    if (!passInput) return;

    const strengthBar = document.getElementById('strength-bar');
    const strengthText = document.getElementById('strength-text');
    const matchText = document.getElementById('match-text');

    passInput.addEventListener('input', function() {
        const val = passInput.value;
        let strength = 0;
        let msg = "";
        let color = '#e2e8f0'; 
        let width = '0%';

        if (val.length >= 8) strength++;
        if (val.match(/[A-Z]/)) strength++;
        if (val.match(/[0-9]/)) strength++;
        if (val.match(/[^a-zA-Z0-9]/)) strength++;

        switch(strength) {
            case 0: width = '10%'; msg = "Too short"; break;
            case 1: width = '25%'; color = '#ef4444'; msg = "Weak"; break;
            case 2: width = '50%'; color = '#f59e0b'; msg = "Fair"; break;
            case 3: width = '75%'; color = '#3b82f6'; msg = "Good"; break;
            case 4: width = '100%'; color = '#10b981'; msg = "Strong"; break;
        }

        if(strengthBar) {
            strengthBar.style.width = width;
            strengthBar.style.backgroundColor = color;
        }
        if(strengthText) {
            strengthText.textContent = msg;
            strengthText.style.color = color;
        }
        if(confirmPassInput) validateMatch();
    });

    if (confirmPassInput) {
        confirmPassInput.addEventListener('input', validateMatch);
    }

    function validateMatch() {
        if (!confirmPassInput || !matchText) return;
        if (confirmPassInput.value && passInput.value !== confirmPassInput.value) {
            matchText.style.display = 'block';
            matchText.textContent = "Passwords do not match";
        } else {
            matchText.style.display = 'none';
        }
    }
}

// --- MAIN DOM INITIALIZATION LOGIC ---
document.addEventListener('DOMContentLoaded', function() {
    
    // 1. Smooth Scrolling Fixed Header System (Safely placed here!)
    const header = document.querySelector('.site-header');
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 30) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
    }

    // 2. Profile Image Preview
    const profileImageInput = document.getElementById('profile_image');
    const profilePreview = document.getElementById('profile-preview');

    if (profileImageInput && profilePreview) {
        profileImageInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    profilePreview.src = e.target.result;
                }
                reader.readAsDataURL(file);
            }
        });
    }

    // 4. Profile Dropdown Logic
    const profileDropdown = document.getElementById('profile-dropdown');
    if (profileDropdown) {
        const profileBtn = document.getElementById('profile-btn');
        profileBtn.addEventListener('click', () => {
            profileDropdown.classList.toggle('open');
        });
        window.addEventListener('click', function(e) {
            if (!profileDropdown.contains(e.target)) {
                profileDropdown.classList.remove('open');
            }
        });
    }

    // 6. Typed.js Hero Animation
    if (document.getElementById('typed-text')) {
        new Typed('#typed-text', {
            strings: ['Homes.', 'Offices.', 'End of Tenancy.', 'Post-Construction.'],
            typeSpeed: 70,
            backSpeed: 50,
            loop: true,
            backDelay: 2000,
        });
    }

    // 7. Service Tile Background Images
    const serviceTiles = document.querySelectorAll('.service-tile');
    if (serviceTiles) {
        const serviceImages = {
            residential: 'Residential.jpg',
            commercial: 'Commercial.jpg',
            deep: 'DeepClean.jpg',
            tenancy: 'End_of_tenancy.jpg'
        };
        serviceTiles.forEach(tile => {
            const service = tile.dataset.service;
            const imageName = serviceImages[service] || 'default_image.jpg';
            tile.style.backgroundImage = `url(/static/img/${imageName})`;
        });
    }

    // 8. Reusable Setup Modal Engine
    const setupModal = (modalId, openButtonIds, closeButtonId, formId, submissionHandler) => {
        const modal = document.getElementById(modalId);
        if (!modal) return;

        const attachFormListeners = () => {
            const form = document.getElementById(formId);
            if (form && submissionHandler) {
                form.removeEventListener('submit', submissionHandler);
                form.addEventListener('submit', submissionHandler);
            }
        };

        function openModal(e) {
            if (e) e.preventDefault();
            modal.classList.add('visible');
            attachFormListeners();
        }

        function closeModal() {
            modal.classList.remove('visible');
        }
        
        openButtonIds.forEach(id => {
            const button = document.getElementById(id);
            if(button) button.addEventListener('click', openModal);
        });

        const closeButton = document.getElementById(closeButtonId);
        if (closeButton) closeButton.addEventListener('click', closeModal);

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        attachFormListeners();
    };

    // 9. Initialize Sub-Modals
    setupModal('contact-modal', ['contact-nav-link', 'hero-contact-btn', 'contact-footer-btn'], 'close-contact-modal-button', 'contact-form', handleContactFormSubmit);
    setupModal('join-team-modal', ['join-team-footer-btn', 'hero-join-team-btn'], 'close-join-team-modal-button', 'staff-application-form', handleStaffApplicationSubmit);
    setupModal('quote-modal', ['hero-quote-btn', 'pricing-tier-1', 'pricing-tier-2', 'pricing-tier-3'], 'close-quote-modal-button', 'quote-request-form', handleQuoteFormSubmit);

    // 10. Service Details Spotlight Modal
    const serviceModal = document.getElementById('service-detail-modal');
    const closeServiceModalButton = document.getElementById('close-service-modal-button');
    const serviceModalTitle = document.getElementById('service-modal-title');
    const serviceModalContent = document.getElementById('service-modal-content');
    const servicesGrid = document.querySelector('.services-grid');

    if (servicesGrid) {
        servicesGrid.addEventListener('click', (e) => {
            const tile = e.target.closest('.service-tile');
            if (!tile) return;
            const serviceKey = tile.dataset.service;
            const details = serviceDetails[serviceKey];
            if (details && serviceModal) {
                if (serviceModalTitle) serviceModalTitle.textContent = details.title;
                if (serviceModalContent) serviceModalContent.innerHTML = details.content;
                serviceModal.classList.add('visible');
            }
        });
    }

    const closeServiceModal = () => {
        if (serviceModal) serviceModal.classList.remove('visible');
    };

    if (closeServiceModalButton) closeServiceModalButton.addEventListener('click', closeServiceModal);
    if (serviceModal) serviceModal.addEventListener('click', (e) => {
        if (e.target === serviceModal) closeServiceModal();
    });

    // 11. FAQ Accordion Engine
    const faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const answer = question.nextElementSibling;
            const isActive = question.classList.contains('active');
            faqQuestions.forEach(q => {
                if (q !== question) {
                    q.classList.remove('active');
                    q.nextElementSibling.style.maxHeight = null;
                }
            });
            if (isActive) {
                question.classList.remove('active');
                answer.style.maxHeight = null;
            } else {
                question.classList.add('active');
                answer.style.maxHeight = answer.scrollHeight + "px";
            }
        });
    });

    // 12. Smooth Scrolling Animations (GSAP)
    document.querySelectorAll('a[href^="/#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            if (window.location.pathname === '/') {
                e.preventDefault();
                let targetId = this.getAttribute('href').substring(2);
                let targetElement = document.getElementById(targetId);

                if (targetElement) {
                    gsap.to(window, {
                        duration: 1,
                        scrollTo: { y: targetElement, offsetY: 0 },
                        ease: "power2.inOut"
                    });
                }
            }
        });
    });

    // 13. Testimonial Carousel Engine
    const testimonialSlider = document.querySelector('.testimonial-slider');
    if (testimonialSlider) {
        const testimonials = document.querySelectorAll('.testimonial-card');
        const dotsContainer = document.querySelector('.testimonial-dots');
        const dots = document.querySelectorAll('.dot');
        let currentTestimonial = 0;
        let slideInterval;

        function updateDots(index) {
            dots.forEach(dot => dot.classList.remove('active'));
            if(dots[index]) dots[index].classList.add('active');
        }

        function showTestimonial(index) {
            testimonials.forEach(testimonial => testimonial.classList.remove('active'));
            if(testimonials[index]) {
                testimonials[index].classList.add('active');
                const activeCardHeight = testimonials[index].offsetHeight;
                testimonialSlider.style.height = `${activeCardHeight}px`;
            }
            updateDots(index);
        }

        function nextTestimonial() {
            currentTestimonial = (currentTestimonial + 1) % testimonials.length;
            showTestimonial(currentTestimonial);
        }
        
        function startSlider() {
            clearInterval(slideInterval);
            slideInterval = setInterval(nextTestimonial, 8000); 
        }

        if (dotsContainer) {
            dotsContainer.addEventListener('click', (e) => {
                if (e.target.matches('.dot')) {
                    currentTestimonial = parseInt(e.target.dataset.index, 10);
                    showTestimonial(currentTestimonial);
                    startSlider(); 
                }
            });
        }

        testimonialSlider.addEventListener('mouseenter', () => clearInterval(slideInterval));
        testimonialSlider.addEventListener('mouseleave', () => startSlider());
        
        showTestimonial(currentTestimonial);
        startSlider(); 
    }

    // 14. GDPR Profile Account Purging Logic
    const deleteBtn = document.getElementById('delete-profile-btn');
    const deleteModal = document.getElementById('delete-confirm-modal');
    const closeDeleteModalBtn = document.getElementById('close-delete-modal-button');
    const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
    const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

    if (deleteBtn && deleteModal && confirmDeleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
            e.preventDefault();
            deleteModal.classList.add('visible');
        });

        confirmDeleteBtn.addEventListener('click', async () => {
            try {
                const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
                const response = await fetch('/delete_account', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken }
                });
                const result = await response.json();

                if (result.status === 'ok') {
                    const completionModal = document.getElementById('deletion-complete-modal');
                    if (completionModal) {
                        deleteModal.classList.remove('visible');
                        completionModal.classList.add('visible');
                        setTimeout(() => { window.location.href = '/'; }, 5000);
                    }
                } else {
                    alert('Purge failed: ' + result.message);
                }
            } catch (error) {
                console.error(error);
            }
        });

        const closeDeleteModal = () => deleteModal.classList.remove('visible');
        if (closeDeleteModalBtn) closeDeleteModalBtn.addEventListener('click', closeDeleteModal);
        if (cancelDeleteBtn) cancelDeleteBtn.addEventListener('click', closeDeleteModal);
    }

    // 15. Form Password Eyeball Toggles
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('password-toggle-icon')) {
            e.preventDefault();
            const input = document.getElementById(e.target.getAttribute('data-target'));
            if (input) {
                if (input.type === 'password') {
                    input.type = 'text';
                    e.target.classList.remove('fa-eye');
                    e.target.classList.add('fa-eye-slash');
                } else {
                    input.type = 'password';
                    e.target.classList.remove('fa-eye-slash');
                    e.target.classList.add('fa-eye');
                }
            }
        }
    });

    // 16. Authentication Modal System Context Boundaries
    const authModal = document.getElementById('auth-modal');
    if (authModal) {
        const openBtns = document.querySelectorAll('#login-nav-btn, .open-auth-modal');
        const closeBtn = document.getElementById('close-auth-modal-button');
        
        // View Elements
        const formsView = document.getElementById('auth-forms-view');
        const forgotView = document.getElementById('auth-forgot-view');
        const successView = document.getElementById('auth-success-view');

        // Tab Logic
        const tabLinks = document.querySelectorAll('.auth-tab-link');
        const forms = document.querySelectorAll('.auth-form-modal');
        
        function switchTab(targetId) {
            tabLinks.forEach(t => t.classList.remove('active'));
            const activeTab = document.querySelector(`.auth-tab-link[data-target-form="${targetId}"]`);
            if(activeTab) activeTab.classList.add('active');

            forms.forEach(f => f.classList.remove('active'));
            const targetForm = document.getElementById(targetId);
            if(targetForm) targetForm.classList.add('active');
        }

        tabLinks.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();
                switchTab(tab.dataset.targetForm);
            });
        });

        // Open/Close & View Switching Logic
        const showView = (viewId) => {
            if(formsView) formsView.style.display = 'none';
            if(forgotView) forgotView.style.display = 'none';
            if(successView) successView.style.display = 'none';
            
            const target = document.getElementById(viewId);
            if(target) target.style.display = 'block';
        };

        const openModal = (e) => {
            if(e) e.preventDefault();
            authModal.classList.add('modal-open'); 
            showView('auth-forms-view'); 
            switchTab('login-form-modal'); 
        };
        
        const closeModal = (e) => {
            if(e) e.preventDefault();
            authModal.classList.remove('modal-open'); 
        };

        openBtns.forEach(btn => btn.addEventListener('click', openModal));
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        authModal.addEventListener('click', (e) => { 
            if (e.target === authModal) closeModal(e); 
        });

        // --- FORGOT PASSWORD FLOW ---
        const forgotLink = document.getElementById('forgot-password-link');
        const backToLogin = document.getElementById('back-to-login-link');
        const forgotForm = document.getElementById('forgot-password-form');
        const successCloseBtn = document.getElementById('success-close-btn');

        if(forgotLink) forgotLink.onclick = (e) => { e.preventDefault(); showView('auth-forgot-view'); };
        if(backToLogin) backToLogin.onclick = (e) => { e.preventDefault(); showView('auth-forms-view'); };
        if(successCloseBtn) successCloseBtn.onclick = closeModal;

        if (forgotForm) {
            forgotForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const btn = document.getElementById('forgot-btn');
                const errDiv = document.getElementById('forgot-error-message');
                const email = document.getElementById('forgot-email').value;
                const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

                btn.disabled = true;
                btn.textContent = "Sending...";
                errDiv.style.display = 'none';

                try {
                    const res = await fetch('/auth/request-password-reset', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-CSRFToken': csrfToken
                        },
                        body: JSON.stringify({ email: email })
                    });
                    const data = await res.json();

                    if (res.ok) {
                        document.getElementById('success-title').textContent = "Check Your Email";
                        document.getElementById('success-message').textContent = data.message;
                        document.getElementById('resend-container').style.display = 'none';
                        document.getElementById('success-close-btn').style.display = 'inline-block';
                        showView('auth-success-view');
                    } else {
                        errDiv.textContent = data.message;
                        errDiv.style.display = 'block';
                    }
                } catch (err) {
                    errDiv.textContent = "System error. Please try again.";
                    errDiv.style.display = 'block';
                } finally {
                    btn.disabled = false;
                    btn.textContent = "Send Instructions";
                }
            });
        }
        // --- RESEND EMAIL LOGIC ---
        const resendBtn = document.getElementById('resend-email-btn');
        if (resendBtn) {
            resendBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const emailToResend = document.getElementById('success-email-display').textContent;
                const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
                const msgEl = document.getElementById('resend-message');
                
                resendBtn.disabled = true;
                resendBtn.textContent = "Sending...";
                msgEl.textContent = "";

                try {
                    const res = await fetch('/auth/resend-confirmation', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRFToken': csrfToken },
                        body: JSON.stringify({ email: emailToResend })
                    });
                    const data = await res.json();
                    
                    msgEl.textContent = data.message;
                    msgEl.style.color = data.status === 'ok' ? '#10b981' : '#ef4444';
                } catch(err) {
                    msgEl.textContent = "Network error. Please try again.";
                    msgEl.style.color = '#ef4444';
                } finally {
                    setTimeout(() => {
                        resendBtn.disabled = false;
                        resendBtn.textContent = "Resend Email";
                    }, 3000);
                }
            });
        }

        // --- HELPER: Post Data (RESTORED) ---
        async function postFormData(url, formData) {
            const data = Object.fromEntries(formData.entries());
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': data.csrf_token || ''
                },
                body: JSON.stringify(data)
            });
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                return { ok: response.ok, json: await response.json() };
            }
            throw new Error("Server Error");
        }

        // --- LOGIN SUBMIT (RESTORED) ---
        const loginForm = document.getElementById('login-form-modal');
        if (loginForm) {
            loginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const errDiv = document.getElementById('login-error-message');
                const btn = loginForm.querySelector('button[type="submit"]');
                errDiv.style.display = 'none';
                btn.textContent = "Logging in...";
                btn.disabled = true;

                try {
                    const { ok, json } = await postFormData(loginForm.action, new FormData(loginForm));
                    if (ok) {
                        window.location.href = json.redirect || '/admin/dashboard';
                    } else {
                        errDiv.innerHTML = json.message;
                        errDiv.style.display = 'block';
                    }
                } catch (err) {
                    errDiv.textContent = "System error.";
                    errDiv.style.display = 'block';
                } finally {
                    btn.textContent = "Log In";
                    btn.disabled = false;
                }
            });
        }

        // --- REGISTER SUBMIT (RESTORED) ---
        const registerForm = document.getElementById('register-form-modal');
        if (registerForm) {
            registerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const errDiv = document.getElementById('register-error-message');
                const btn = document.getElementById('register-btn');
                const pass = document.getElementById('register-password').value;
                const confirm = document.getElementById('register-password-confirm').value;

                if (pass !== confirm) {
                    document.getElementById('match-text').style.display = 'block';
                    return;
                }
                if (document.querySelectorAll('.password-requirements li.invalid').length > 0) {
                    errDiv.textContent = "Please meet all password requirements.";
                    errDiv.style.display = 'block';
                    return;
                }

                errDiv.style.display = 'none';
                btn.textContent = "Creating Account...";
                btn.disabled = true;

                try {
                    const formData = new FormData(registerForm);
                    const { ok, json } = await postFormData(registerForm.action, formData);
                    
                    if (ok) {
                        document.getElementById('success-title').textContent = "Verify Your Email";
                        document.getElementById('success-message').textContent = "Please check your email to verify your account.";
                        
                        const resendContainer = document.getElementById('resend-container');
                        resendContainer.style.display = 'block';
                        document.getElementById('success-email-display').textContent = formData.get('email');
                        document.getElementById('success-close-btn').style.display = 'none';

                        showView('auth-success-view');
                    } else {
                        errDiv.textContent = json.message;
                        errDiv.style.display = 'block';
                        btn.textContent = "Create Account";
                        btn.disabled = false;
                    }
                } catch (err) {
                    errDiv.textContent = "System error.";
                    errDiv.style.display = 'block';
                    btn.textContent = "Create Account";
                    btn.disabled = false;
                }
            });
        }

        // --- PASSWORD VALIDATION LOGIC (RESTORED) ---
        const regPass = document.getElementById('register-password');
        const regConfirm = document.getElementById('register-password-confirm');
        
        if (regPass) {
            regPass.addEventListener('input', function() {
                const val = this.value;
                const reqs = {
                    length: val.length >= 8,
                    upper: /[A-Z]/.test(val),
                    lower: /[a-z]/.test(val),
                    number: /[0-9]/.test(val),
                    special: /[^a-zA-Z0-9]/.test(val)
                };
                let allValid = true;
                for (const [key, isValid] of Object.entries(reqs)) {
                    const el = document.getElementById(`req-${key}`);
                    if (el) {
                        if (isValid) { el.classList.add('valid'); el.classList.remove('invalid'); }
                        else { el.classList.remove('valid'); el.classList.add('invalid'); allValid = false; }
                    }
                }
                if (allValid) this.classList.add('valid-input'); else this.classList.remove('valid-input');
                if (regConfirm && regConfirm.value) checkMatch();
            });
        }

        if (regConfirm) {
            regConfirm.addEventListener('input', checkMatch);
        }

        function checkMatch() {
            const matchText = document.getElementById('match-text');
            if (regPass.value && regPass.value === regConfirm.value) {
                matchText.style.display = 'none';
                regConfirm.classList.add('valid-input'); 
                regConfirm.classList.remove('invalid-input');
            } else {
                if (regConfirm.value.length > 0) {
                    matchText.style.display = 'block';
                    regConfirm.classList.remove('valid-input');
                    regConfirm.classList.add('invalid-input'); 
                } else {
                    matchText.style.display = 'none';
                    regConfirm.classList.remove('valid-input');
                    regConfirm.classList.remove('invalid-input');
                }
            }
        }
    }

    // 17. Form Password Visibility Option Boxes
    const setupPasswordCheckbox = (checkboxId, inputId) => {
        const checkbox = document.getElementById(checkboxId);
        const passwordInput = document.getElementById(inputId);
        if (checkbox && passwordInput) {
            checkbox.addEventListener('change', function() {
                passwordInput.setAttribute('type', this.checked ? 'text' : 'password');
            });
        }
    };
    setupPasswordCheckbox('showLoginPassword', 'login-password');
    setupPasswordCheckbox('showRegisterPassword', 'register-password');
    setupPasswordCheckbox('showConfirmPassword', 'register-confirm-password');

// --- CLOSES THE MAIN DOM PARSING CONTEXT WALL CLEANLY RIGHT HERE ---
});

// ==========================================
// FORM HANDLERS & HELPERS (RESTORED)
// ==========================================

async function handleContactFormSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const modal = document.getElementById('contact-modal');
  const modalContent = form.parentElement;
  
  const data = { 
    name: form.name.value, 
    email: form.email.value, 
    phone: form.phone.value, 
    area: form.area.value,
    message: form.message.value 
  };

  try {
    const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
    
    const res = await fetch('/api/contact', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken
      },
      body: JSON.stringify(data)
    });

    if (!res.ok) {
        const errorJson = await res.json();
        throw new Error(errorJson.message || 'A server error occurred.');
    }
    
    const json = await res.json();
    
    if (modalContent) {
        modalContent.innerHTML = `
            <button id="close-contact-modal-button" class="modal-close" aria-label="Close contact form">&times;</button>
            <p style="text-align: center; font-size: 1.1rem; color: var(--accent); padding: 40px 0;">${json.message}</p>
        `;
        const newCloseButton = modalContent.querySelector('#close-contact-modal-button');
        if (newCloseButton && modal) {
            newCloseButton.addEventListener('click', () => modal.classList.remove('visible'));
        }
    }
  } catch (error) {
     console.error("Contact form submission error:", error);
     if (modalContent) {
        modalContent.innerHTML = `
            <button id="close-contact-modal-button" class="modal-close" aria-label="Close contact form">&times;</button>
            <p style="text-align: center; font-size: 1.1rem; color: #c82333; padding: 40px 0;">
                <strong>Error:</strong> Could not send message. Please try again later.
            </p>
        `;
        const newCloseButton = modalContent.querySelector('#close-contact-modal-button');
        if (newCloseButton && modal) {
            newCloseButton.addEventListener('click', () => modal.classList.remove('visible'));
        }
     }
  }
}

async function handleQuoteFormSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = document.getElementById('quote-submit-btn');
    const alertPlaceholder = document.getElementById('quote-alert-placeholder');
    const quoteModal = document.getElementById('quote-modal'); 

    alertPlaceholder.textContent = ''; 
    alertPlaceholder.className = 'flash'; 
    alertPlaceholder.style.display = 'none'; 

    submitBtn.disabled = true;
    const originalBtnText = submitBtn.textContent;
    submitBtn.textContent = 'Submitting...';

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
        // Grab the CSRF token from the page's meta tag
        const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');

        const response = await fetch('/api/request-quote', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'X-CSRFToken': csrfToken // Add the security token to the headers!
            }, 
            body: JSON.stringify(data)
        });

        const result = await response.json();

        if (response.ok) {
            alertPlaceholder.textContent = result.message;
            alertPlaceholder.className = 'flash success';
            alertPlaceholder.style.display = 'block'; 
            form.reset(); 

            setTimeout(() => {
                if (quoteModal) quoteModal.classList.remove('visible');
                submitBtn.disabled = false; 
                submitBtn.textContent = originalBtnText;
            }, 3000);

        } else {
            alertPlaceholder.textContent = result.message || 'An error occurred submitting your request.';
            alertPlaceholder.className = 'flash error';
            alertPlaceholder.style.display = 'block';
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    } catch (error) {
        console.error("Quote Submission Error:", error);
        alertPlaceholder.textContent = 'A network error occurred. Please check connection and try again.';
        alertPlaceholder.className = 'flash error';
        alertPlaceholder.style.display = 'block';
        submitBtn.disabled = false;
        submitBtn.textContent = originalBtnText;
    } 
}

async function initializePaystack(bookingData) {
    try {
        // 1. Guardrail: Paystack will instantly fail if the cart is R0.00
        if (!bookingData.totalPrice || bookingData.totalPrice <= 0) {
            alert("Your cart total is R0.00. Please select a service to proceed to payment.");
            const payBtn = document.getElementById('wizard-pay-btn');
            if(payBtn) {
                payBtn.innerText = 'Pay & Book';
                payBtn.disabled = false;
            }
            return;
        }

        // 2. Trigger Paystack directly on the frontend (Bypass the missing backend route)
        const handler = PaystackPop.setup({
            key: 'pk_test_8aeed7ae6e10339f657b2f986288333b5db779a3', // Your test key
            email: bookingData.email,
            amount: parseInt(bookingData.totalPrice * 100), // Paystack requires cents
            currency: 'ZAR',
            ref: `booking_${Math.floor((Math.random() * 1000000000) + 1)}`,
            metadata: {
                type: "public_booking",
                payer_name: bookingData.full_name
            },
            callback: function(response) {
                // Redirect to the success page upon successful payment
                window.location.href = `/payment-callback?reference=${response.reference}`;
            },
            onClose: function() {
                alert('Payment window closed. Your booking was saved, but payment is pending.');
                const payBtn = document.getElementById('wizard-pay-btn');
                if(payBtn) {
                    payBtn.innerText = 'Pay & Book';
                    payBtn.disabled = false;
                }
            }
        });
        
        handler.openIframe();

    } catch (error) {
        console.error('Paystack initialization error:', error);
        alert('An error occurred setting up payment.');
    }
}

async function handleStaffApplicationSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const modal = document.getElementById('join-team-modal');
    const modalContent = form.parentElement;
    const formData = new FormData(form);

    try {
        const csrfToken = document.querySelector('meta[name="csrf-token"]').getAttribute('content');
        const res = await fetch('/api/staff_apply', {
            method: 'POST',
            headers: { 'X-CSRFToken': csrfToken },
            body: formData 
        });
        const json = await res.json();

        if (modalContent) {
            modalContent.innerHTML = `
                <button id="close-join-team-modal-button" class="modal-close" aria-label="Close form">&times;</button>
                <p style="text-align: center; font-size: 1.1rem; color: var(--accent); padding: 40px 0;">${json.message}</p>
            `;
            const newCloseButton = modalContent.querySelector('#close-join-team-modal-button');
            if (newCloseButton && modal) {
                newCloseButton.addEventListener('click', () => modal.classList.remove('visible'));
            }
        }
    } catch (error) {
        console.error("Staff application submission error:", error);
        alert('An unexpected error occurred. Please try again.');
    }
}

async function loadServiceCategories(selectElementId) {
    const selectEl = document.getElementById(selectElementId);
    if (!selectEl) return;
    if (selectEl.options.length > 1) return;

    try {
        const response = await fetch('/api/services'); 
        if (!response.ok) throw new Error('Failed to fetch services');
        const allServicesData = await response.json();

        if (allServicesData.length > 0) {
            allServicesData.forEach(category => {
                const option = document.createElement('option');
                option.value = category.id;
                option.textContent = category.name;
                selectEl.appendChild(option);
            });
        } else {
            selectEl.innerHTML = '<option value="" disabled>No services available</option>';
        }
    } catch (error) {
        console.error('Error loading service categories:', error);
        selectEl.innerHTML = '<option value="" disabled>Error loading services</option>';
    }
}

function handlePropertyTypeChange(e) {
  const value = e.target.value;
  const residentialDetails = document.getElementById('residential-details');
  const commercialDetails = document.getElementById('commercial-details');
  if (!residentialDetails || !commercialDetails) return;

  if (value === 'Residential') {
    residentialDetails.classList.remove('hidden');
    commercialDetails.classList.add('hidden');
  } else if (value === 'Commercial' || value === 'Industrial' || value === 'Body Corporate') {
    residentialDetails.classList.add('hidden');
    commercialDetails.classList.remove('hidden');
  } else {
    residentialDetails.classList.add('hidden');
    commercialDetails.classList.add('hidden');
  }
}

function handleFrequencyChange(e) {
  const value = e.target.value;
  const recurringOptions = document.getElementById('recurring-options');
  if (!recurringOptions) return;

  if (value === 'Recurring') {
    recurringOptions.classList.remove('hidden');
  } else {
    recurringOptions.classList.add('hidden');
  }
}

// ==========================================
// PUBLIC BOOKING WIZARD (SINGLE TENANT)
// ==========================================

// ==========================================
// VIBRANT BOOKING WIZARD ENGINE (SWEEPSOUTH STYLE)
// ==========================================
let wizardState = {
    categoryId: null,
    categoryName: '',
    items: {}, // Stores quantity of selected items { itemId: {qty, price} }
    total: 0,
    servicesData: [] // Stores the API response
};
let wizardDataLoaded = false;

async function initBookingWizard() {
    try {
        const response = await fetch('/api/public/services');
        wizardState.servicesData = await response.json();
        
        const catContainer = document.getElementById('wizard-categories');
        if(catContainer) catContainer.innerHTML = '';

        wizardState.servicesData.forEach(cat => {
            const card = document.createElement('div');
            card.className = 'wizard-cat-card';
            card.innerHTML = `<h3 style="color: #002244; margin: 0;">${cat.name}</h3>`;
            card.onclick = () => selectCategory(cat.id, cat.name);
            if(catContainer) catContainer.appendChild(card);
        });
    } catch (err) {
        console.error("Failed to load services", err);
    }
}

// --- FLATPICKR DATE & TIME ENGINE ---
function initDateTimePickers() {
    const dateInput = document.getElementById('wizard-date');
    const timeInput = document.getElementById('wizard-time');
    const warningMsg = document.getElementById('time-warning-msg');
    const warningText = document.getElementById('warning-text-content');
    const confirmBtn = document.getElementById('booking-confirm-btn') || document.getElementById('booking-next-step-btn');
    
    if (!dateInput || !timeInput || typeof flatpickr === 'undefined') return;

    const minBusinessHour = 8;
    const maxBusinessHour = 17;

    // THE SWOOSH FUNCTION
    function showWarning(msg) {
        warningText.innerText = msg;
        warningMsg.classList.add('show');
    }

    function validateTimeSelection() {
        if (!dateInput.value || !timePicker.selectedDates[0]) return;

        const now = new Date();
        const todayStr = flatpickr.formatDate(now, "Y-m-d");
        const isToday = (dateInput.value === todayStr);

        let bufferTime = new Date();
        bufferTime.setHours(bufferTime.getHours() + 1);
        const bufferHour = bufferTime.getHours();
        const bufferMin = bufferTime.getMinutes();

        const selTime = timePicker.selectedDates[0];
        const selHour = selTime.getHours();
        const selMin = selTime.getMinutes();

        if (isToday && (selHour < bufferHour || (selHour === bufferHour && selMin < bufferMin))) {
            showWarning("Take note: Same-day service requires at least 1 hour notice.");
            timeInput.classList.add('invalid-time-input');
            if (timePicker.timeContainer) timePicker.timeContainer.classList.add('invalid-time');
            if (confirmBtn) confirmBtn.disabled = true;
        } else {
            warningMsg.classList.remove('show');
            timeInput.classList.remove('invalid-time-input');
            if (timePicker.timeContainer) timePicker.timeContainer.classList.remove('invalid-time');
            if (confirmBtn) confirmBtn.disabled = false;
        }
    }

    // 1. Initialize Time Picker
    const timePicker = flatpickr(timeInput, {
        enableTime: true,
        noCalendar: true,
        dateFormat: "H:i",
        time_24hr: true,
        minuteIncrement: 1, // <--- FIX: Counts by 1 minute now
        minTime: "08:00",
        maxTime: "17:00",
        clickOpens: false,
        onOpen: function() { document.body.style.overflow = 'hidden'; },
        onClose: function() { document.body.style.overflow = 'auto'; },
        onChange: validateTimeSelection
    });

    // 2. Initialize Date Picker
    flatpickr(dateInput, {
        minDate: "today",
        dateFormat: "Y-m-d",
        onChange: function(selectedDates, dateStr, instance) {
            if (selectedDates.length === 0) {
                timePicker.set("clickOpens", false);
                timeInput.disabled = true;
                return;
            }

            timePicker.set("clickOpens", true);
            timeInput.disabled = false;

            const selectedDate = selectedDates[0];
            const now = new Date();
            const isToday = selectedDate.toDateString() === now.toDateString();

            if (isToday) {
                let bufferTime = new Date();
                bufferTime.setHours(bufferTime.getHours() + 1);
                const bufferHour = bufferTime.getHours();
                const bufferMin = bufferTime.getMinutes();

                // If past business hours, block today entirely
                if (bufferHour >= maxBusinessHour && bufferMin > 0) {
                    showWarning("It is too late to book for today. Please select tomorrow.");
                    instance.clear(); 
                    timePicker.clear();
                    timePicker.set("clickOpens", false);
                    timeInput.disabled = true;
                    if (confirmBtn) confirmBtn.disabled = true;
                    return;
                }

                // AUTO-ALLOCATE: Set to exactly 1 hour from now (within business hours)
                let autoH = Math.max(minBusinessHour, bufferHour);
                let autoM = (autoH === bufferHour) ? bufferMin : 0;
                let autoTimeStr = String(autoH).padStart(2, '0') + ":" + String(autoM).padStart(2, '0');
                
                timePicker.setDate(autoTimeStr, true);

            } else {
                // Future dates: Auto-allocate to 08:00 AM
                if (timePicker.selectedDates.length === 0) {
                    timePicker.setDate("08:00", true);
                }
            }
            
            // Run validation instantly so everything resets to standard colors
            validateTimeSelection();
        }
    });
}

function goToStep(stepNumber) {
    document.querySelectorAll('.wizard-step-container').forEach(el => el.classList.remove('active'));
    const targetStep = document.getElementById(`booking-step-${stepNumber}`);
    if(targetStep) targetStep.classList.add('active');
    
    if(stepNumber === 3) {
        buildScopeUI();
        initDateTimePickers(); // <--- Triggers the calendar rules
    }
}

function selectCategory(catId, catName) {
    wizardState.categoryId = catId;
    wizardState.categoryName = catName;
    wizardState.items = {}; // Reset cart on new category
    calculateTotal();
    goToStep(2);
}

// A simple icon mapper to give extras cute icons based on their name
function getIconForService(name) {
    const n = name.toLowerCase();
    if (n.includes('oven')) return 'fa-fire-burner';
    if (n.includes('fridge')) return 'fa-snowflake';
    if (n.includes('window')) return 'fa-border-all';
    if (n.includes('wall')) return 'fa-layer-group';
    if (n.includes('iron') || n.includes('laundry')) return 'fa-shirt';
    if (n.includes('cabinet') || n.includes('cupboard')) return 'fa-box-archive';
    return 'fa-plus-circle'; // fallback
}

// --- TOOLTIP CSS INJECTION ---
if (!document.getElementById('blitz-tooltip-styles')) {
    const style = document.createElement('style');
    style.id = 'blitz-tooltip-styles';
    style.innerHTML = `
      .blitz-tooltip { position: relative; display: inline-flex; align-items: center; margin-left: 10px; z-index: 50; }
      .blitz-tooltip .tooltip-icon { color: #9ca3af; font-size: 1.1rem; transition: color 0.2s; cursor: help; }
      .blitz-tooltip:hover .tooltip-icon { color: #006ac6; }
      .blitz-tooltip .tooltip-text {
        visibility: hidden; width: 240px; background-color: #1f2937; color: #fff;
        text-align: center; border-radius: 8px; padding: 10px; position: absolute;
        z-index: 100; bottom: 150%; left: 50%; transform: translateX(-50%); opacity: 0;
        transition: opacity 0.2s; font-size: 0.85rem; font-weight: normal; line-height: 1.4;
        box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1); pointer-events: none;
      }
      .blitz-tooltip .tooltip-text::after {
        content: ""; position: absolute; top: 100%; left: 50%;
        margin-left: -6px; border-width: 6px; border-style: solid;
        border-color: #1f2937 transparent transparent transparent;
      }
      .blitz-tooltip:hover .tooltip-text, .blitz-tooltip:active .tooltip-text { visibility: visible; opacity: 1; }
      
      /* --- NEW: MODERN DATE/TIME UI --- */
      /* --- MODERN DATE/TIME UI --- */
      .modern-datetime {
        width: 100%; padding: 12px 15px; border: 2px solid #e5e7eb; border-radius: 8px;
        background-color: #f9fafb; font-size: 1rem; color: #1f2937; font-weight: 500;
        transition: all 0.2s ease; outline: none; cursor: pointer; box-sizing: border-box;
      }
      .modern-datetime:focus {
        border-color: #006ac6; background-color: #fff; box-shadow: 0 0 0 4px rgba(0, 106, 198, 0.1);
      }
      .modern-datetime:disabled {
        background-color: #f3f4f6; color: #9ca3af; cursor: not-allowed; border-color: #d1d5db; opacity: 0.7;
      }
      
      /* --- FLOATING ERROR TOAST (THE SWOOSH) --- */
      .time-warning-toast {
        position: absolute; bottom: 100%; right: 0; margin-bottom: 8px;
        background-color: #fef2f2; color: #b91c1c; border: 1px solid #f87171;
        padding: 8px 14px; border-radius: 6px; font-size: 0.85rem; font-weight: 500;
        display: flex; align-items: center; gap: 8px; z-index: 20;
        box-shadow: 0 4px 10px rgba(220, 38, 38, 0.15);
        opacity: 0; transform: translateY(10px); pointer-events: none;
        transition: opacity 0.3s ease, transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      }
      .time-warning-toast.show {
        opacity: 1; transform: translateY(0); pointer-events: auto;
      }

      /* --- MINIMALIST ARROWS --- */
      .flatpickr-time .numInputWrapper span.arrowUp,
      .flatpickr-time .numInputWrapper span.arrowDown {
        border: none !important; /* Removes the ugly boxy lines */
        width: 30px; /* Wider hit area */
        background: transparent !important;
      }
      .flatpickr-time .numInputWrapper span.arrowUp::after { border-bottom-color: #9ca3af; }
      .flatpickr-time .numInputWrapper span.arrowDown::after { border-top-color: #9ca3af; }
      .flatpickr-time .numInputWrapper span.arrowUp:hover::after { border-bottom-color: #006ac6; }
      .flatpickr-time .numInputWrapper span.arrowDown:hover::after { border-top-color: #006ac6; }

      /* --- RED ERROR STYLES --- */
      .flatpickr-time.invalid-time input,
      .flatpickr-time.invalid-time .flatpickr-time-separator {
        color: #dc2626 !important;
      }
      input.modern-datetime.invalid-time-input {
        color: #dc2626 !important; border-color: #f87171 !important; background-color: #fef2f2 !important;
      }
    `;
    document.head.appendChild(style);
}

function buildScopeUI() {
    const scopeContainer = document.getElementById('wizard-scope-items');
    const extrasContainer = document.getElementById('wizard-extras-items');
    if(!scopeContainer || !extrasContainer) return;
    
    scopeContainer.innerHTML = '';
    extrasContainer.innerHTML = '';
    
    const category = wizardState.servicesData.find(c => c.id === wizardState.categoryId);
    if(!category) return;

    // --- 1. DYNAMIC PROMPT QUESTION ---
    const questionHeader = document.createElement('h4');
    questionHeader.style.width = '100%';
    questionHeader.style.marginBottom = '15px';
    questionHeader.style.color = '#374151';
    questionHeader.innerText = category.prompt_question || 'Please select your base service:';
    scopeContainer.appendChild(questionHeader);

    const primaryItems = category.items.filter(i => !i.is_extra);
    const extraItems = category.items.filter(i => i.is_extra);
    const hasPrimarySelected = primaryItems.some(item => wizardState.items[item.id]);

    // --- HELPER: GENERATE TOOLTIP HTML ---
    const generateTooltip = (description) => {
        if (!description || description.trim() === '') return '';
        const safeDesc = description.replace(/\n/g, '<br>');
        // event.preventDefault() stops the radio/checkbox from triggering if they just click the icon on mobile
        return `
            <div class="blitz-tooltip" onclick="event.preventDefault();">
                <i class="fa-solid fa-circle-info tooltip-icon"></i>
                <span class="tooltip-text">${safeDesc}</span>
            </div>
        `;
    };

    // --- 3. RENDER PRIMARY SCOPE ---
    primaryItems.forEach(item => {
        const row = document.createElement('label');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.width = '100%';
        row.style.padding = '15px';
        row.style.marginBottom = '10px';
        row.style.border = '1px solid #d1d5db';
        row.style.borderRadius = '8px';
        row.style.cursor = 'pointer';
        row.style.transition = 'all 0.2s ease-in-out';
        
        const isSelected = wizardState.items[item.id] ? 'checked' : '';
        if (isSelected) {
            row.style.borderColor = '#006ac6';
            row.style.backgroundColor = '#f0f9ff';
        }

        row.innerHTML = `
            <input type="radio" name="primary_scope" value="${item.id}" ${isSelected} 
                   onchange="handlePrimarySelection(${item.id}, ${item.default_rate}, '${category.id}')" 
                   style="margin-right: 15px; transform: scale(1.2);">
            <div style="flex-grow: 1; display: flex; align-items: center;">
                <strong style="color: #002244; font-size: 1.1rem; margin: 0;">${item.name}</strong>
                ${generateTooltip(item.description)}
            </div>
        `;
        
        row.onchange = (e) => {
            document.querySelectorAll('input[name="primary_scope"]').forEach(r => {
                r.parentElement.style.borderColor = '#d1d5db';
                r.parentElement.style.backgroundColor = 'transparent';
            });
            e.target.parentElement.style.borderColor = '#006ac6';
            e.target.parentElement.style.backgroundColor = '#f0f9ff';
        };

        scopeContainer.appendChild(row);
    });

    // --- 4. RENDER EXTRAS (Add-ons) ---
    if (extraItems.length === 0) {
        extrasContainer.innerHTML = '<p style="color: #9ca3af; width: 100%; text-align: center;">No extras available for this service.</p>';
    } else {
        const extrasHeader = document.createElement('h4');
        extrasHeader.style.width = '100%';
        extrasHeader.style.marginBottom = '15px';
        extrasHeader.style.marginTop = '10px';
        extrasHeader.style.color = '#374151';
        extrasHeader.innerText = 'Do you need any extras?';
        extrasContainer.appendChild(extrasHeader);

        // LOCK EXTRAS IF NO PRIMARY IS SELECTED
        if (!hasPrimarySelected && primaryItems.length > 0) {
            extrasContainer.style.opacity = '0.4';
            extrasContainer.style.pointerEvents = 'none';
            extrasContainer.title = "Please select a primary service first.";
        } else {
            extrasContainer.style.opacity = '1';
            extrasContainer.style.pointerEvents = 'auto';
            extrasContainer.title = "";
        }

        extraItems.forEach(item => {
            if (item.pricing_type !== 'fixed') {
                // Render +/- Counter
                const currentQty = wizardState.items[item.id] ? wizardState.items[item.id].qty : 0;
                const row = document.createElement('div');
                row.className = 'wizard-item-row';
                row.style.width = '100%';
                row.style.display = 'flex';
                row.style.justifyContent = 'space-between';
                row.style.alignItems = 'center';
                row.style.padding = '10px 0';
                row.style.borderBottom = '1px solid #f3f4f6';
                
                row.innerHTML = `
                    <div style="display: flex; align-items: center;">
                        <strong style="color: #374151; margin: 0;">${item.name}</strong>
                        ${generateTooltip(item.description)}
                    </div>
                    <div class="wizard-counter">
                        <button type="button" onclick="updateItem(${item.id}, -1, ${item.default_rate}, true)">-</button>
                        <span id="qty-${item.id}" style="font-size: 1.1rem; font-weight: bold; width: 30px; text-align: center; display: inline-block;">${currentQty}</span>
                        <button type="button" onclick="updateItem(${item.id}, 1, ${item.default_rate}, true)">+</button>
                    </div>
                `;
                extrasContainer.appendChild(row);
            } else {
                // Render Checkbox
                const isSelected = wizardState.items[item.id] ? 'checked' : '';
                const row = document.createElement('label');
                row.style.display = 'flex';
                row.style.alignItems = 'center';
                row.style.width = '100%';
                row.style.padding = '10px 0';
                row.style.borderBottom = '1px solid #f3f4f6';
                row.style.cursor = 'pointer';
                
                row.innerHTML = `
                    <input type="checkbox" ${isSelected} onchange="updateItem(${item.id}, this.checked ? 1 : 0, ${item.default_rate}, false)" style="margin-right: 15px; transform: scale(1.2);">
                    <div style="flex-grow: 1; display: flex; align-items: center;">
                        <strong style="color: #374151; margin: 0;">${item.name}</strong>
                        ${generateTooltip(item.description)}
                    </div>
                `;
                extrasContainer.appendChild(row);
            }
        });
    }
}

// --- HELPER FUNCTION: Handle Primary Selection & Unlock Extras ---
function handlePrimarySelection(itemId, price, categoryId) {
    const category = wizardState.servicesData.find(c => c.id == categoryId);
    if(!category) return;

    // 1. Wipe out any previously selected Primary Scope items from the cart
    const primaryItemIds = category.items.filter(i => !i.is_extra).map(i => i.id);
    primaryItemIds.forEach(id => {
        if (wizardState.items[id]) {
            delete wizardState.items[id];
        }
    });

    // 2. Add the newly selected Primary Scope item
    wizardState.items[itemId] = { qty: 1, price: price };
    
    // 3. Unlock the Extras grid visually and functionally
    const extrasContainer = document.getElementById('wizard-extras-items');
    if (extrasContainer) {
        extrasContainer.style.opacity = '1';
        extrasContainer.style.pointerEvents = 'auto';
        extrasContainer.title = "";
    }

    // 4. Update the total price
    calculateTotal();
}

// Logic for Primary Scope (Only one can be selected)
window.handleBaseTileClick = function(id, price) {
    const tile = document.getElementById(`tile-${id}`);
    
    document.querySelectorAll('.base-size-tile').forEach(t => t.classList.remove('selected'));
    Object.keys(wizardState.items).forEach(key => {
        if(wizardState.items[key].isBase) wizardState.items[key].qty = 0;
    });
    
    tile.classList.add('selected');
    updateItem(id, 1, price, false);
};

// Logic for Extras (Click to select, click again to unselect, or reveal counter)
window.handleExtraClick = function(id, price, hasMultiples) {
    const tile = document.getElementById(`tile-${id}`);
    
    if (!hasMultiples) {
        // Standard extra (e.g. Oven Cleaning)
        tile.classList.toggle('selected');
        updateItem(id, tile.classList.contains('selected') ? 1 : 0, price, false);
    } else {
        // Multiple extra (e.g. Windows) - First click activates it
        if (!tile.classList.contains('selected')) {
            tile.classList.add('selected');
            document.getElementById(`counter-wrap-${id}`).style.display = 'flex';
            updateItem(id, 1, price, true); // Set qty to 1 immediately
        }
    }
};

// The engine that drives the math
// The engine that drives the math
window.updateItem = function(id, amount, price, isCounter = false) {
    if (isCounter) {
        let currentQty = wizardState.items[id]?.qty || 0;
        let newQty = Math.max(0, parseInt(currentQty) + parseInt(amount)); // Stop at 0
        
        // THE FIX: If > 0, update it. If 0, DELETE it completely.
        if (newQty > 0) {
            wizardState.items[id] = { qty: newQty, price: parseFloat(price) };
        } else {
            delete wizardState.items[id]; // <--- Wipes the ghost item
            
            // Your custom UI reset logic
            const tile = document.getElementById(`tile-${id}`);
            if (tile) tile.classList.remove('selected');
            
            const counterWrap = document.getElementById(`counter-wrap-${id}`);
            if (counterWrap) counterWrap.style.display = 'none';
        }
        
        const qtySpan = document.getElementById(`qty-${id}`);
        if(qtySpan) qtySpan.innerText = newQty;
        
    } else {
        // Checkbox logic
        if (amount > 0) {
            wizardState.items[id] = { qty: amount, price: parseFloat(price) };
        } else {
            delete wizardState.items[id]; // <--- Wipes the ghost item
        }
    }
    
    calculateTotal();
};

window.handleTileClick = function(id, price, isBase) {
    const tile = document.getElementById(`tile-${id}`);
    
    if (isBase) {
        // 1. Visually deselect all other base tiles
        document.querySelectorAll('.base-size-tile').forEach(t => t.classList.remove('selected'));
        
        // 2. Set all base items in the cart to qty 0 (Clears the math)
        Object.keys(wizardState.items).forEach(key => {
            if(wizardState.items[key].isBase) {
                wizardState.items[key].qty = 0;
            }
        });
        
        // 3. Select this new tile and add to cart
        tile.classList.add('selected');
        updateItem(id, 1, price, false);
    } else {
        // Extras can be toggled on and off independently
        tile.classList.toggle('selected');
        updateItem(id, tile.classList.contains('selected') ? 1 : 0, price, false);
    }
};

window.validateCartAndProceed = function() {
    let hasBaseSelection = false;
    
    // Check the cart. Since we preserved the flag, this will now work perfectly.
    Object.values(wizardState.items).forEach(item => {
        if (item.isBase && item.qty > 0) hasBaseSelection = true;
    });

    if (!hasBaseSelection) {
        alert("Please select a primary scope (e.g. home size) to continue.");
        return;
    }
    
    goToStep(4);
};

function calculateTotal() {
    wizardState.total = Object.values(wizardState.items).reduce((sum, item) => sum + (item.qty * item.price), 0);
    const priceLabel = document.getElementById('wizard-live-price');
    if(priceLabel) priceLabel.innerText = `R ${wizardState.total.toFixed(2)}`;
}

// Modal Trigger & Submit Logic
document.addEventListener('DOMContentLoaded', () => {
    const bookingModal = document.getElementById('booking-modal');
    const openButtons = ['hero-book-btn', 'quote-button', 'final-cta-btn'];
    
    openButtons.forEach(id => {
        const btn = document.getElementById(id);
        if(btn) {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                if(bookingModal) bookingModal.classList.add('visible');
                if (!wizardDataLoaded) {
                    initBookingWizard();
                    wizardDataLoaded = true;
                }
                goToStep(1); // Always reset to step 1 on open
            });
        }
    });

    const closeBookingBtn = document.getElementById('close-booking-modal-button');
    const closeFunc = (e) => {
        if(e) e.preventDefault();
        if(bookingModal) bookingModal.classList.remove('visible');
    };
    
    if (closeBookingBtn) closeBookingBtn.addEventListener('click', closeFunc);
    if (bookingModal) bookingModal.addEventListener('click', (e) => {
        if (e.target === bookingModal) closeFunc(e);
    });

    const payBtn = document.getElementById('wizard-pay-btn');
    if(payBtn) {
        payBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const date = document.getElementById('wizard-date').value;
            const email = document.getElementById('wizard-email').value;
            const name = document.getElementById('wizard-name').value;
            const address = document.getElementById('street-address').value;
            const frequency = document.getElementById('wizard-frequency').value;

            if(!date || !email || !name || !address) {
                alert("Please fill out your address, name, email, and schedule date.");
                return;
            }

            payBtn.innerText = 'Processing...';
            payBtn.disabled = true;

            const payload = {
                service_name: wizardState.categoryName,
                estimated_total: wizardState.total,
                address: address,
                date: date,
                time: document.getElementById('wizard-time').value,
                email: email,
                full_name: name,
                phone_number: ''
            };

            try {
                // 1. Log the lead in the database first (so you don't lose them if they abandon cart)
                const response = await fetch('/api/public/book', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (!response.ok) {
                    throw new Error("Failed to save booking details.");
                }

                // 2. TRIGGER PAYSTACK SECURE CHECKOUT
                payBtn.innerText = 'Opening Secure Checkout...';
                
                const paystackData = {
                    email: payload.email,
                    totalPrice: payload.estimated_total,
                    full_name: payload.full_name
                };
                
                // This calls the existing Paystack function in your site.js
                await initializePaystack(paystackData);
                
                // Close the wizard modal so the Paystack iframe takes center stage
                const closeBookingBtn = document.getElementById('close-booking-modal-button');
                if(closeBookingBtn) closeBookingBtn.click(); 

            } catch(err) {
                console.error(err);
                alert("An error occurred connecting to the server.");
                payBtn.innerText = 'Pay & Book';
                payBtn.disabled = false;
            } finally {
                // Only reset the button if Paystack didn't redirect them
                payBtn.innerText = 'Pay & Book';
                payBtn.disabled = false;
            }
        });
    }
});

// --- GOOGLE MAPS FUNCTIONALITY (Consolidated) ---
let map;
let marker;
let autocomplete;

function initMap() {
    // Prevent double-loading
    if (mapInitialized) return;
    mapInitialized = true;

    // 1. Initialize the Booking Modal Logic (if present)
    // This connects your services/pricing logic
    if (typeof initBookingModal === "function") {
        initBookingModal(); 
    }

    // 2. HOMEPAGE HERO SEARCH (The New Part)
    const heroInput = document.getElementById('hero-location-input');
    if (heroInput) {
        const heroAutocomplete = new google.maps.places.Autocomplete(heroInput, {
            componentRestrictions: { country: "za" }, // South Africa only
            fields: ["formatted_address", "geometry", "name"],
            types: ["geocode"] // Favor addresses
        });

        // When user selects an address, just ensure the text is correct
        heroAutocomplete.addListener("place_changed", () => {
             const place = heroAutocomplete.getPlace();
             if (place.formatted_address) {
                 heroInput.value = place.formatted_address;
             }
        });
    }

    // 3. BOOKING MODAL MAP (The Existing Part)
    const mapElement = document.getElementById("map");
    const streetAddressInput = document.getElementById("street-address");

    if (mapElement && streetAddressInput) {
        const capeTown = { lat: -33.9249, lng: 18.4241 };
        
        map = new google.maps.Map(mapElement, {
            zoom: 12,
            center: capeTown,
            mapTypeControl: false,
            streetViewControl: false,
        });
        
        marker = new google.maps.Marker({ map, position: capeTown, draggable: true });
        
        autocomplete = new google.maps.places.Autocomplete(streetAddressInput, {
            componentRestrictions: { country: "za" },
            fields: ["formatted_address", "geometry", "name"],
            types: ["address"],
        });

        autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place.geometry || !place.geometry.location) return;

            streetAddressInput.value = place.formatted_address;
            map.setCenter(place.geometry.location);
            map.setZoom(17);
            marker.setPosition(place.geometry.location);
        });

        marker.addListener('dragend', () => {
            const geocoder = new google.maps.Geocoder();
            geocoder.geocode({ 'location': marker.getPosition() }, (results, status) => {
                if (status === 'OK' && results[0]) {
                    streetAddressInput.value = results[0].formatted_address;
                } else { 
                    console.error('Geocoder failed due to: ' + status); 
                }
            });
        });
    }
}

// Expose to global scope so Google Script can find it
window.initMap = initMap;