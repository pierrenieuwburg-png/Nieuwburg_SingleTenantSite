"""Master-admin (platform owner) area — F3.

A SEPARATE platform area (design decision #5), distinct from the tenant admin
panel. Every route here is gated by `master_admin_required` (F1): role
'master_admin' with NO tenant_id. F3a is the minimal shell + read-only catalogue
API; create/edit/delete land in F3b.

CSRF: this blueprint is NOT csrf-exempt (unlike api_bp/market_bp) — the React
master UI sends X-CSRFToken on mutations (F3b). F3a is read-only (GET), so no
token is required yet.
"""
from flask import Blueprint, jsonify, render_template
from .. import db
from ..models import MarketplaceService
from .admin import master_admin_required

bp = Blueprint('master', __name__)


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
