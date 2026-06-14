// --- GLOBAL VARIABLES ---
// --- GLOBAL VARIABLES ---
let masterTimeline;

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

    // 3. Connect Individual Service Buttons
    const serviceItemButtons = document.querySelectorAll('.service-item-book-button');
    const bookingModalToOpen = document.getElementById('booking-modal');

    if (bookingModalToOpen && serviceItemButtons.length > 0) {
        let dataLoaded = !document.getElementById('booking-category-list'); 

        const openModalForServiceItems = (e) => {
            e.preventDefault();
            bookingModalToOpen.classList.add('visible');
            if (!dataLoaded) {
                initBookingModal(); 
                dataLoaded = true;
            } else {
                renderStep1(); 
            }
        };

        serviceItemButtons.forEach(btn => {
            btn.addEventListener('click', openModalForServiceItems);
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

    // 5. Booking Modal Core Open/Close Triggers
    const bookingModal = document.getElementById('booking-modal');
    if (bookingModal) {
        const openButtons = ['dashboard-quote-btn', 'quote-button', 'hero-book-btn', 'final-cta-btn'];
        const closeButton = document.getElementById('close-booking-modal-button');
        let dataLoaded = false;

        const openBookingModal = (e) => {
            e.preventDefault();
            bookingModal.classList.add('visible');
            if (!dataLoaded) {
                initBookingModal(); 
                dataLoaded = true;
            } else {
                renderStep1(); 
            }
        };
        
        const closeBookingModal = () => {
            bookingModal.classList.remove('visible');
        };

        openButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) btn.addEventListener('click', openBookingModal);
        });

        if (closeButton) closeButton.addEventListener('click', closeBookingModal);
        bookingModal.addEventListener('click', (e) => {
            if (e.target === bookingModal) closeBookingModal();
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
    setupModal('quote-modal', ['hero-quote-btn'], 'close-quote-modal-button', 'quote-request-form', handleQuoteFormSubmit);

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
        const formsView = document.getElementById('auth-forms-view');
        const forgotView = document.getElementById('auth-forgot-view');
        const successView = document.getElementById('auth-success-view');
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
            tab.addEventListener('click', (e) => { e.preventDefault(); switchTab(tab.dataset.targetForm); });
        });

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
        const closeModal = () => authModal.classList.remove('modal-open');

        openBtns.forEach(btn => btn.addEventListener('click', openModal));
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        authModal.addEventListener('click', (e) => { if (e.target === authModal) closeModal(); });
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
// PUBLIC BOOKING WIZARD (SINGLE TENANT)
// ==========================================

let bookingState = {
    service_name: '',
    estimated_total: 0,
    address: '',
    date: '',
    time: '',
    full_name: '',
    email: '',
    phone_number: ''
};
let categoriesCache = [];
let mvpDataLoaded = false;

async function initWizard() {
    const categoryList = document.getElementById('booking-category-list');
    if (!categoryList) return;
    
    categoryList.innerHTML = '<p>Loading services...</p>';
    try {
        const response = await fetch('/api/public/services');
        categoriesCache = await response.json();
        renderCategories();
    } catch (error) {
        categoryList.innerHTML = '<p>Error loading services. Please try again later.</p>';
        console.error(error);
    }
}

function renderCategories() {
    const categoryList = document.getElementById('booking-category-list');
    categoryList.innerHTML = '';
    categoriesCache.forEach(category => {
        const btn = document.createElement('button');
        btn.className = 'cta-outline';
        btn.style.width = '100%';
        btn.style.marginBottom = '10px';
        btn.innerText = category.name;
        btn.onclick = () => renderServices(category);
        categoryList.appendChild(btn);
    });
}

function renderServices(category) {
    const categoryList = document.getElementById('booking-category-list');
    categoryList.innerHTML = `<h4 style="margin-bottom: 15px;">${category.name}</h4>`;
    
    category.items.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'cta';
        btn.style.width = '100%';
        btn.style.marginBottom = '10px';
        btn.innerText = `${item.name} - R${item.default_rate}`;
        btn.onclick = () => {
            bookingState.service_name = item.name;
            bookingState.estimated_total = item.default_rate;
            goToStep(2);
        };
        categoryList.appendChild(btn);
    });

    const backBtn = document.createElement('button');
    backBtn.className = 'cta-outline';
    backBtn.style.marginTop = '10px';
    backBtn.innerText = '← Back to Categories';
    backBtn.onclick = () => renderCategories();
    categoryList.appendChild(backBtn);
}

function goToStep(stepIndex) {
    const steps = [
        document.getElementById('booking-step-1'),
        document.getElementById('booking-step-2-address'),
        document.getElementById('booking-step-3-details'),
        document.getElementById('booking-step-4-confirm')
    ];
    
    steps.forEach(step => { if(step) step.classList.add('hidden'); });
    if(steps[stepIndex - 1]) steps[stepIndex - 1].classList.remove('hidden');

    if (stepIndex === 3) {
        document.getElementById('booking-price-total').innerText = `R${bookingState.estimated_total}`;
        document.getElementById('booking-summary-container').classList.remove('hidden');
    }
    if (stepIndex === 4) {
        document.getElementById('address-display-text').innerText = bookingState.address || 'Address not provided';
        const timeSelect = document.getElementById('booking-time');
        timeSelect.innerHTML = `
            <option value="08:00">08:00 AM</option>
            <option value="12:00">12:00 PM</option>
            <option value="15:00">03:00 PM</option>
        `;
        timeSelect.disabled = false;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.booking-back-btn').forEach(btn => {
        btn.onclick = (e) => {
            const targetStep = parseInt(e.target.getAttribute('data-target-step'));
            goToStep(targetStep);
        };
    });

    const addressNext = document.getElementById('booking-address-next-btn');
    if(addressNext) {
        addressNext.onclick = () => {
            bookingState.address = document.getElementById('street-address').value;
            goToStep(3);
        };
    }

    const detailsNext = document.getElementById('booking-next-step-btn');
    if(detailsNext) detailsNext.onclick = () => goToStep(4);

    const confirmBtn = document.getElementById('booking-confirm-btn');
    if(confirmBtn) {
        confirmBtn.onclick = async (e) => {
            const btn = e.target;
            btn.innerText = 'Submitting...';
            btn.disabled = true;

            bookingState.date = document.getElementById('booking-date').value;
            bookingState.time = document.getElementById('booking-time').value;
            bookingState.full_name = document.getElementById('customer-name').value;
            bookingState.email = document.getElementById('customer-email').value;
            bookingState.phone_number = document.getElementById('customer-phone').value;

            try {
                const response = await fetch('/api/public/book', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(bookingState)
                });

                if (response.ok) {
                    alert("Booking Request Submitted Successfully! We will contact you shortly.");
                    document.getElementById('close-booking-modal-button').click(); 
                    goToStep(1); 
                } else {
                    alert("Failed to submit booking. Please check your details.");
                }
            } catch (error) {
                console.error(error);
                alert("An error occurred.");
            } finally {
                btn.innerText = 'Confirm & Proceed to Payment';
                btn.disabled = false;
            }
        };
    }

    const bookingModal = document.getElementById('booking-modal');
    if (bookingModal) {
        const openButtons = ['dashboard-quote-btn', 'quote-button', 'hero-book-btn', 'final-cta-btn'];
        const openFunc = (e) => {
            e.preventDefault();
            bookingModal.classList.add('visible');
            if (!mvpDataLoaded) {
                initWizard();
                mvpDataLoaded = true;
            } else {
                goToStep(1);
            }
        };
        openButtons.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                const newBtn = btn.cloneNode(true);
                btn.parentNode.replaceChild(newBtn, btn);
                newBtn.addEventListener('click', openFunc);
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