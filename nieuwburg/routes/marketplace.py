from flask import Blueprint, jsonify, request
from sqlalchemy import or_
from sqlalchemy.orm import joinedload
from ..models import ServiceItem, Tenant, BusinessSettings, ServiceCategory, MarketplaceService
from .. import db

bp = Blueprint('marketplace', __name__, url_prefix='/api/marketplace')


def _public_service(svc):
    """DISPLAY-SAFE serializer for the public discovery surface (F5).

    Deliberately SEPARATE from master.py's _serialize — it must NEVER leak
    master-admin internals (created_by_tenant_id, review_status, is_active). It
    exposes only what a tile needs: name, category, bookability, and pricing for
    display.
    """
    if svc.pricing_mode == 'flat':
        from_price = svc.flat_price
        price_display = f"R{svc.flat_price:.2f}" if svc.flat_price else None
        prices = []
    elif svc.pricing_mode == 'frequency':
        prices = [{"frequency": p.frequency, "price": p.price} for p in svc.prices]
        vals = [p.price for p in svc.prices if p.price is not None]
        from_price = min(vals) if vals else None
        price_display = f"From R{from_price:.2f}" if from_price else None
    else:
        from_price = None
        price_display = None
        prices = []

    return {
        "name": svc.name,
        "category": svc.category,
        "is_quick_bookable": svc.is_quick_bookable,
        "pricing_mode": svc.pricing_mode,
        "flat_price": svc.flat_price,
        "prices": prices,
        "from_price": from_price,
        "price_display": price_display,
    }


@bp.route('/services', methods=['GET'])
def public_marketplace_services():
    """Public, UNGATED read of the platform Quick Book catalogue for the client
    discovery surface (F5). Uses its own display-safe serializer (NOT master's).

    Filters is_active AND review_status == 'approved' — this also enforces that
    F4's future PENDING tenant-created items stay OFF the public site until a
    master admin approves them.
    """
    services = (
        MarketplaceService.query
        .filter(
            MarketplaceService.is_active == True,   # noqa: E712
            MarketplaceService.review_status == 'approved',
        )
        .order_by(MarketplaceService.name)
        .all()
    )
    return jsonify([_public_service(s) for s in services]), 200

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

    # Build the query ONCE with every join the filters and output need:
    #   - Tenant for the trust filters + business name search
    #   - BusinessSettings (outer join) for the location filter + display address;
    #     outer so services on a tenant without a settings row still surface,
    #     while the location filter below naturally excludes null addresses.
    #   - ServiceCategory for display.
    query = (
        ServiceItem.query
        .join(Tenant, ServiceItem.tenant_id == Tenant.id)
        .outerjoin(BusinessSettings, BusinessSettings.tenant_id == Tenant.id)
        .join(ServiceCategory, ServiceItem.category_id == ServiceCategory.id)
        .filter(
            Tenant.is_active == True,
            Tenant.verification_status == 'verified'  # <--- THE TRUST FILTER
        )
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

    if category_id.isdigit():
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

        # business_settings is uselist=False and nullable — guard it.
        settings = item.tenant.business_settings

        data.append({
            "service_id": item.id,
            "title": item.name,
            "description": item.description,
            "price_display": price_display,
            "pricing_type": item.pricing_type,
            "tenant": {
                "id": item.tenant.id,
                "name": item.tenant.business_name,
                "location": settings.business_address if settings else None,
                # member_since / rating / review_count dropped — no reviews feature
                # and these fields don't exist on ServiceItem (they caused the 500).
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