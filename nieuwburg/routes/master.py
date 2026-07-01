"""Master-admin (platform owner) area — F3.

A SEPARATE platform area (design decision #5), distinct from the tenant admin
panel. Every route here is gated by `master_admin_required` (F1): role
'master_admin' with NO tenant_id. F3a is the minimal shell + read-only catalogue
API; create/edit/delete land in F3b.

CSRF: this blueprint is NOT csrf-exempt (unlike api_bp/market_bp) — the React
master UI sends X-CSRFToken on mutations (F3b). F3a is read-only (GET), so no
token is required yet.
"""
from flask import Blueprint, jsonify, render_template, request
from .. import db
from ..models import MarketplaceService, MarketplaceServicePrice, Job
from .admin import master_admin_required

bp = Blueprint('master', __name__)

# Frequencies are constrained to the set the client booking modal offers, so a
# catalogue row always matches what resolve_price_for_job looks up (D3).
ALLOWED_FREQUENCIES = ('Once-off', 'Weekly', 'Bi-Weekly', 'Monthly')


def _serialize(svc, include_prices=False):
    data = {
        "id": svc.id,
        "name": svc.name,
        "category": svc.category,
        "is_active": svc.is_active,
        "is_quick_bookable": svc.is_quick_bookable,
        "pricing_mode": svc.pricing_mode,
        "flat_price": svc.flat_price,
        "review_status": svc.review_status,
        "created_by_tenant_id": svc.created_by_tenant_id,
    }
    if include_prices or svc.pricing_mode == 'frequency':
        data["prices"] = [
            {"id": p.id, "frequency": p.frequency, "price": p.price}
            for p in svc.prices
        ]
    return data


# --- SPA shell (platform area). Gated by master_admin_required ALONE (it checks
# is_authenticated), so non-master/anonymous get a redirect for pages. ---
@bp.route('/', defaults={'path': ''})
@bp.route('/<path:path>')
@master_admin_required
def master_spa_shell(path):
    return render_template('master/master_base.html')


# --- JSON API (F3a: read-only catalogue). master_admin_required returns a 403
# JSON for non-master/anonymous callers (path contains '/api/'). ---
@bp.route('/api/services', methods=['GET'])
@master_admin_required
def list_services():
    services = MarketplaceService.query.order_by(MarketplaceService.name).all()
    return jsonify([_serialize(s) for s in services]), 200


@bp.route('/api/services/<int:service_id>', methods=['GET'])
@master_admin_required
def get_service(service_id):
    svc = db.session.get(MarketplaceService, service_id)
    if svc is None:
        return jsonify({"message": "Service not found."}), 404
    return jsonify(_serialize(svc, include_prices=True)), 200


# =========================================================
# Mutations (F3b). CSRF-protected (blueprint is NOT exempt — the React UI sends
# X-CSRFToken). Gated by master_admin_required, same as the reads.
# =========================================================

def _validate_service_payload(data):
    """Return an error string, or None if valid. Only Quick-Bookable items need
    pricing; quote-only items just need a name."""
    name = (data.get('name') or '').strip()
    if not name:
        return "Name is required."
    if not data.get('is_quick_bookable'):
        return None  # quote-only: no pricing required

    mode = data.get('pricing_mode')
    if mode not in ('flat', 'frequency'):
        return "pricing_mode must be 'flat' or 'frequency' for a Quick-Bookable item."

    if mode == 'flat':
        try:
            fp = float(data.get('flat_price'))
        except (TypeError, ValueError):
            return "flat_price must be a number."
        if fp <= 0:
            return "flat_price must be greater than 0."
        return None

    # frequency
    rows = data.get('prices') or []
    if not rows:
        return "At least one frequency price is required."
    seen = set()
    for row in rows:
        freq = (row.get('frequency') or '').strip()
        if freq not in ALLOWED_FREQUENCIES:
            return f"Invalid frequency '{freq}'. Allowed: {', '.join(ALLOWED_FREQUENCIES)}."
        if freq in seen:
            return f"Duplicate frequency '{freq}'."
        seen.add(freq)
        try:
            p = float(row.get('price'))
        except (TypeError, ValueError):
            return f"Price for '{freq}' must be a number."
        if p <= 0:
            return f"Price for '{freq}' must be greater than 0."
    return None


def _apply_scalar_pricing(svc, data):
    """Set is_quick_bookable / pricing_mode / flat_price from a validated payload."""
    quick = bool(data.get('is_quick_bookable', False))
    svc.is_quick_bookable = quick
    if not quick:
        svc.pricing_mode = None
        svc.flat_price = None
    elif data.get('pricing_mode') == 'flat':
        svc.pricing_mode = 'flat'
        svc.flat_price = float(data['flat_price'])
    else:  # 'frequency'
        svc.pricing_mode = 'frequency'
        svc.flat_price = None


def _replace_prices(svc, data):
    """Replace the item's frequency price rows with the payload's. Deletes old
    rows and flushes BEFORE inserting new ones, so a same-flush delete+insert of
    the same frequency can't trip the UNIQUE(item, frequency) constraint, and no
    orphan rows survive."""
    MarketplaceServicePrice.query.filter_by(
        marketplace_service_id=svc.id
    ).delete(synchronize_session=False)
    db.session.flush()
    if svc.is_quick_bookable and svc.pricing_mode == 'frequency':
        for row in data.get('prices', []):
            db.session.add(MarketplaceServicePrice(
                marketplace_service_id=svc.id,
                frequency=row['frequency'].strip(),
                price=float(row['price']),
            ))


@bp.route('/api/services', methods=['POST'])
@master_admin_required
def create_service():
    data = request.get_json(silent=True) or {}
    err = _validate_service_payload(data)
    if err:
        return jsonify({"message": err}), 400

    name = data['name'].strip()
    if MarketplaceService.query.filter_by(name=name).first():
        return jsonify({"message": f"A service named '{name}' already exists."}), 409

    svc = MarketplaceService(
        name=name,
        category=((data.get('category') or '').strip() or None),
        is_active=bool(data.get('is_active', True)),
        # SERVER-FORCED — never trusted from the request body:
        created_by_tenant_id=None,
        review_status='approved',
    )
    _apply_scalar_pricing(svc, data)
    db.session.add(svc)
    db.session.flush()          # obtain svc.id for the price rows
    _replace_prices(svc, data)
    db.session.commit()
    return jsonify(_serialize(svc, include_prices=True)), 201


@bp.route('/api/services/<int:service_id>', methods=['PUT'])
@master_admin_required
def update_service(service_id):
    svc = db.session.get(MarketplaceService, service_id)
    if svc is None:
        return jsonify({"message": "Service not found."}), 404

    data = request.get_json(silent=True) or {}
    err = _validate_service_payload(data)
    if err:
        return jsonify({"message": err}), 400

    name = data['name'].strip()
    dup = MarketplaceService.query.filter(
        MarketplaceService.name == name, MarketplaceService.id != svc.id
    ).first()
    if dup:
        return jsonify({"message": f"A service named '{name}' already exists."}), 409

    svc.name = name
    svc.category = ((data.get('category') or '').strip() or None)
    if 'is_active' in data:
        svc.is_active = bool(data['is_active'])
    _apply_scalar_pricing(svc, data)
    # created_by_tenant_id and review_status are server-owned — NOT touched here.
    _replace_prices(svc, data)
    db.session.commit()
    return jsonify(_serialize(svc, include_prices=True)), 200


@bp.route('/api/services/<int:service_id>/toggle-active', methods=['POST'])
@master_admin_required
def toggle_service_active(service_id):
    svc = db.session.get(MarketplaceService, service_id)
    if svc is None:
        return jsonify({"message": "Service not found."}), 404
    svc.is_active = not svc.is_active
    db.session.commit()
    return jsonify(_serialize(svc, include_prices=True)), 200


@bp.route('/api/services/<int:service_id>', methods=['DELETE'])
@master_admin_required
def delete_service(service_id):
    svc = db.session.get(MarketplaceService, service_id)
    if svc is None:
        return jsonify({"message": "Service not found."}), 404
    # Protect booked-job integrity: refuse to delete an item any Job references;
    # deactivate it instead (D1).
    in_use = db.session.query(Job.id).filter_by(marketplace_service_id=svc.id).first()
    if in_use:
        return jsonify({
            "message": "This service is used by existing jobs — deactivate it instead of deleting."
        }), 409
    db.session.delete(svc)   # cascade removes its price rows
    db.session.commit()
    return jsonify({"message": "Service deleted."}), 200
