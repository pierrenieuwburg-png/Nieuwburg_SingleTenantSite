// --- GOOGLE MAPS AUTOCOMPLETE SETUP ---
function initGooglePlaces() {
    const locationInput = document.getElementById('hero-location-input');
    
    if (!locationInput) return;

    const options = {
        componentRestrictions: { country: 'za' }, // Limit to South Africa
        fields: ['formatted_address', 'geometry', 'name'], // Only fetch what we need
        types: ['geocode'] // Bias towards addresses, not businesses
    };

    const autocomplete = new google.maps.places.Autocomplete(locationInput, options);

    // Optional: Listen for selection to do something cool (like auto-search)
    autocomplete.addListener('place_changed', function() {
        const place = autocomplete.getPlace();
        console.log("Selected:", place.formatted_address);
        // You could auto-trigger the search here if you wanted:
        // document.getElementById('hero-search-btn').click();
    });
}

// --- EXISTING MARKETPLACE LOGIC ---
document.addEventListener('DOMContentLoaded', function() {
    const searchInput = document.getElementById('hero-search-input');
    const locationInput = document.getElementById('hero-location-input');
    const searchBtn = document.getElementById('hero-search-btn');
    const resultsContainer = document.getElementById('marketplace-results');
    const resultsSection = document.getElementById('results-section');

    // 1. The Search Function
    async function performSearch() {
        const query = searchInput.value;
        const location = locationInput.value;

        // Basic Validation
        if(!query && !location) {
            alert("Please enter a service or location to search.");
            return;
        }

        // Visuals: Scroll to results and show loader
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth' });
        resultsContainer.innerHTML = '<div class="loader"></div>';

        try {
            // Call YOUR API
            const response = await fetch(`/api/marketplace/search?q=${query}&location=${location}`);
            const services = await response.json();

            // Clear loader
            resultsContainer.innerHTML = '';

            if (services.length === 0) {
                resultsContainer.innerHTML = `
                    <div class="no-results" style="grid-column: 1/-1; text-align: center; padding: 40px;">
                        <h3 style="color: #002244;">No pros found matching that criteria.</h3>
                        <p>Try adjusting your search terms or location.</p>
                    </div>`;
                return;
            }

            // --- LIMIT TO TOP 3 MATCHES ---
            const topMatches = services.slice(0, 3);

            // Build Cards
            topMatches.forEach(service => {
                const card = document.createElement('div');
                card.className = 'service-card';
                
                // Randomize avatar color for visual variety
                const colors = ['#3b82f6', '#10b981', '#f59e0b', '#6366f1'];
                const randomColor = colors[Math.floor(Math.random() * colors.length)];
                const initial = service.tenant.name.charAt(0).toUpperCase();

                // PREPARE DATA FOR BUTTON (Safe encoding for quotes)
                // This ensures "Pierre's Plumbing" doesn't break the HTML
                const serviceData = JSON.stringify(service).replace(/'/g, "&#39;");

                card.innerHTML = `
                    <div class="card-header">
                        <div class="tenant-avatar" style="background-color: ${randomColor}">${initial}</div>
                        <div class="tenant-info">
                            <h4>${service.tenant.name}</h4>
                            <span class="location-badge">📍 ${service.tenant.location || 'Cape Town'}</span>
                        </div>
                    </div>
                    <div class="card-body">
                        <h3>${service.title}</h3>
                        <p class="price-tag">${service.price_display}</p>
                        <p class="description truncate">${service.description || 'No description provided.'}</p>
                    </div>
                    <div class="card-footer">
                        <button class="book-btn" onclick='openProviderModal(${serviceData})'>View Details & Book</button>
                    </div>
                `;
                resultsContainer.appendChild(card);
            });

        } catch (error) {
            console.error('Search failed:', error);
            resultsContainer.innerHTML = '<p class="error">Something went wrong. Please try again.</p>';
        }
    }

    // 2. Event Listeners
    if (searchBtn) {
        searchBtn.addEventListener('click', performSearch);
    }

    // Allow "Enter" key to search in both inputs
    [searchInput, locationInput].forEach(input => {
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') performSearch();
            });
        }
    });
});

// Placeholder for Phase 3
function openBookingModal(serviceId) {
    console.log(`Opening booking wizard for Service ID: ${serviceId}`);
    // Logic to open React Modal or redirect to booking page will go here
}

// Expose init function to global scope for Google Maps Callback
window.initGooglePlaces = initGooglePlaces;

function openProviderModal(service) {
    const modal = document.getElementById('provider-modal');

    // Populate Data
    document.getElementById('spotlight-business-name').textContent = service.tenant.name;
    document.getElementById('spotlight-avatar').textContent = service.tenant.name.charAt(0);
    document.getElementById('spotlight-rating').textContent = service.tenant.rating || "New";
    document.getElementById('spotlight-year').textContent = service.tenant.member_since || "2024";

    document.getElementById('spotlight-service-title').textContent = service.title;
    document.getElementById('spotlight-price').textContent = service.price_display;
    document.getElementById('spotlight-description').textContent = service.description || "No detailed description provided.";

    // Set Booking Button Action (To be connected to Booking Wizard later)
    document.getElementById('spotlight-book-btn').onclick = function() {
        // Close this modal and open booking wizard
        modal.classList.remove('visible');
        // Trigger your existing booking flow (Phase 3)
        alert("Starting booking for " + service.title);
    };

    modal.classList.add('visible');
}

function closeProviderModal() {
    document.getElementById('provider-modal').classList.remove('visible');
}