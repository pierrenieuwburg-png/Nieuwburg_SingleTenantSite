from flask import Blueprint, jsonify, request
from sqlalchemy import or_
from sqlalchemy.orm import joinedload
from ..models import ServiceItem, Tenant, BusinessSettings, ServiceCategory
from .. import db

bp = Blueprint('marketplace', __name__, url_prefix='/api/marketplace')

@bp.route('/search', methods=['GET'])
def search_marketplace():
    """
    Public endpoint to search for services across ALL active tenants.
    Query Params:
      - q: Keyword (Service Name, Description, or Business Name)
      - location: Address/Suburb substring
      - category_id: Specific category filter
    """
    keyword = request.args.get('q', '').strip()
    location = request.args.get('location', '').strip()
    category_id = request.args.get('category_id', '').strip()

    # 1. Start with ServiceItems, Join Tenant to ensure they are Active
    query = ServiceItem.query.join(Tenant).filter(Tenant.is_active == True)

    # 2. Join BusinessSettings for Location Search
    query = query.join(BusinessSettings)

    # 3. Join Category for filtering and display
    query = query.join(ServiceCategory, ServiceItem.category_id == ServiceCategory.id)

    query = ServiceItem.query.join(Tenant).filter(
        Tenant.is_active == True,
        Tenant.verification_status == 'verified' # <--- THE TRUST FILTER
    )

    # --- APPLY FILTERS ---

    if keyword:
        search_term = f"%{keyword}%"
        query = query.filter(
            or_(
                ServiceItem.name.ilike(search_term),
                ServiceItem.description.ilike(search_term),
                Tenant.business_name.ilike(search_term)
            )
        )

    if location:
        # Simple text match for MVP. Later: PostGIS or Google Maps Distance.
        query = query.filter(BusinessSettings.business_address.ilike(f"%{location}%"))

    if category_id:
        query = query.filter(ServiceItem.category_id == int(category_id))

    # Limit results to prevent massive payloads
    results = query.limit(50).all()

    # --- FORMAT OUTPUT ---
    data = []
    for item in results:
        # Format Price Logic for Display
        price_display = f"R{item.default_rate:.2f}"
        if item.is_variable_price:
            price_display = f"From {price_display}"
        
        if item.pricing_type == 'hourly':
            price_display += " /hr"
        elif item.pricing_type == 'sqm':
            price_display += " /m²"
        elif item.pricing_type == 'meter':
            price_display += " /m"
        elif item.pricing_type == 'liter':
            price_display += " /L"

        data.append({
            "service_id": item.id,
            "title": item.name,
            "description": item.description,
            "price_display": price_display,
            "pricing_type": item.pricing_type,
            "tenant": {
                "id": item.tenant.id,
                "name": item.tenant.business_name,
                "location": item.tenant.business_settings.business_address,
                "member_since": item.member_since,
                "rating": item.rating,
                "review_count": item.review_count
            },
            "category": item.category.name if item.category else "General"
        })

    return jsonify(data)

@bp.route('/categories', methods=['GET'])
def get_public_categories():
    """Returns a list of categories for the search dropdown."""
    # You might want to distinct this if multiple tenants use the same category names,
    # but since categories are currently tenant-specific in your DB, we might want 
    # to return unique names or global categories if you have them.
    # For now, let's return all categories that have at least one active service.
    
    categories = db.session.query(ServiceCategory.name).join(ServiceItem).join(Tenant).filter(
        Tenant.is_active == True
    ).distinct().all()
    
    return jsonify([c[0] for c in categories])