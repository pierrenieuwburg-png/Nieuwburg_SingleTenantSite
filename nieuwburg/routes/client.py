from flask import Blueprint, jsonify, request, render_template, Response, current_app
from flask_login import login_required, current_user
from sqlalchemy.orm import joinedload
from ..models import QuoteRequest, Quote, Invoice, Job, Profile
from .. import db
from datetime import datetime
import os

# --- NEW IMPORTS from utils (Ensure these exist in routes/utils.py) ---
from .utils import render_template_to_pdf, log_activity

bp = Blueprint('client', __name__, url_prefix='/client')

def check_client_access():
    if not current_user.is_authenticated or current_user.role != 'client':
        return False
    return True

# =========================================================
# 1. API ROUTES
# =========================================================

@bp.route('/api/dashboard', methods=['GET'])
@login_required
def get_client_dashboard():
    if not check_client_access(): return jsonify({"message": "Unauthorized"}), 403

    pending_requests = QuoteRequest.query.filter_by(user_id=current_user.id, status='Pending').count()
    pending_formal = Quote.query.filter_by(user_id=current_user.id, status='Sent').count()
    unpaid_invoices = Invoice.query.filter_by(user_id=current_user.id, status='Unpaid').count()
    upcoming_jobs = Job.query.filter(
        Job.client_id == current_user.id,
        Job.status.in_(['Scheduled', 'En Route', 'In Progress'])
    ).count()

    personal_profile = next((p for p in current_user.profiles if p.tenant_id is None), None)
    display_name = personal_profile.full_name if personal_profile else (current_user.email or "Neighbor")
    display_address = personal_profile.address if personal_profile else ""

    return jsonify({
        "stats": {
            "pending_quotes": pending_requests + pending_formal,
            "unpaid_invoices": unpaid_invoices,
            "upcoming_jobs": upcoming_jobs
        },
        "profile": {
            "name": display_name,
            "address": display_address
        }
    })

@bp.route('/api/my-quotes', methods=['GET'])
@login_required
def get_my_quotes():
    if not check_client_access(): return jsonify({"message": "Unauthorized"}), 403
    requests = QuoteRequest.query.filter_by(user_id=current_user.id).order_by(QuoteRequest.request_date.desc()).all()
    formal_quotes = Quote.query.filter_by(user_id=current_user.id).order_by(Quote.quote_date.desc()).all()
    combined_data = []
    
    for r in requests:
        combined_data.append({
            "id": r.id, "type": "request", "display_id": f"REQ-{r.id}",
            "service_title": r.primary_service or "General Request",
            "date": r.request_date.strftime('%d %b %Y') if r.request_date else "N/A",
            "sort_date": r.request_date.isoformat() if r.request_date else "",
            "status": r.status, "amount": r.total_price or 0.0, "is_actionable": False
        })
    for q in formal_quotes:
        combined_data.append({
            "id": q.id, "type": "formal", "display_id": q.quote_number,
            "service_title": "Formal Quote",
            "date": q.quote_date.strftime('%d %b %Y') if q.quote_date else "N/A",
            "sort_date": q.quote_date.strftime('%Y-%m-%d') if q.quote_date else "",
            "status": q.status, "amount": q.total, "is_actionable": q.status == 'Sent'
        })
    combined_data.sort(key=lambda x: x['sort_date'], reverse=True)
    return jsonify(combined_data)

@bp.route('/api/my-invoices', methods=['GET'])
@login_required
def get_my_invoices():
    if not check_client_access(): return jsonify({"message": "Unauthorized"}), 403
    invoices = Invoice.query.filter_by(user_id=current_user.id).order_by(Invoice.invoice_date.desc()).all()
    data = [{
        "id": inv.id, "number": inv.invoice_number,
        "due_date": inv.due_date.strftime('%d %b %Y') if inv.due_date else '-',
        "total": inv.total, "status": inv.status, "payment_token": inv.payment_token
    } for inv in invoices]
    return jsonify(data)

@bp.route('/api/my-bookings', methods=['GET'])
@login_required
def get_my_bookings():
    if not check_client_access(): return jsonify({"message": "Unauthorized"}), 403
    jobs = Job.query.options(joinedload(Job.service)).filter(Job.client_id == current_user.id).order_by(Job.scheduled_date.desc()).all()
    data = [{
        "id": j.id,
        "date": j.scheduled_date.strftime('%d %b %Y') if j.scheduled_date else "N/A",
        "time": j.start_time.strftime('%H:%M') if j.start_time else "TBD",
        "service_name": j.service.name if j.service else "Custom Service",
        "status": j.status, "notes": j.notes, "staff_assigned": len(j.assigned_staff) > 0
    } for j in jobs]
    return jsonify(data)

@bp.route('/api/profile', methods=['POST'])
@login_required
def update_my_profile():
    if not check_client_access(): return jsonify({"message": "Unauthorized"}), 403
    data = request.json
    personal_profile = Profile.query.filter_by(user_id=current_user.id, tenant_id=None).first()
    if not personal_profile:
        personal_profile = Profile(user_id=current_user.id, tenant_id=None)
        db.session.add(personal_profile)
    
    personal_profile.full_name = data.get('full_name', personal_profile.full_name)
    personal_profile.phone_number = data.get('phone_number', personal_profile.phone_number)
    personal_profile.address = data.get('address', personal_profile.address)
    
    try:
        db.session.commit()
        return jsonify({"message": "Profile updated successfully"})
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error updating profile"}), 500

# --- NEW ROUTES FOR PDF & ACCEPTANCE ---
@bp.route('/api/quotes/<int:quote_id>/download', methods=['GET'])
@login_required
def download_client_quote(quote_id):
    if not check_client_access(): return jsonify({"message": "Unauthorized"}), 403

    # Ensure quote belongs to this user
    quote = Quote.query.filter_by(id=quote_id, user_id=current_user.id).first()
    if not quote:
        return jsonify({"message": "Quote not found"}), 404

    try:
        logo_path = os.path.join(current_app.root_path, 'static', 'img', 'LogoBlackWithTitle.png')
        pdf_data = render_template_to_pdf(
            'public/quote_pdf_template.html', 
            quote=quote,
            logo_url=logo_path
        )
        
        return Response(
            pdf_data,
            mimetype='application/pdf',
            headers={'Content-Disposition': f'attachment;filename=Quote_{quote.quote_number}.pdf'}
        )
    except Exception as e:
        print(f"Error downloading quote PDF: {e}")
        return jsonify({"message": "Could not generate PDF"}), 500

@bp.route('/api/quotes/<int:quote_id>/respond', methods=['POST'])
@login_required
def respond_to_quote(quote_id):
    if not check_client_access(): return jsonify({"message": "Unauthorized"}), 403

    data = request.json
    action = data.get('action') # 'accept' or 'reject'
    
    quote = Quote.query.filter_by(id=quote_id, user_id=current_user.id).first()
    if not quote:
        return jsonify({"message": "Quote not found"}), 404

    # Allow clients to accept 'Sent' quotes.
    if quote.status not in ['Sent', 'Viewed']:
        return jsonify({"message": f"Cannot change status of a {quote.status} quote."}), 400

    if action == 'accept':
        quote.status = 'Accepted'
        log_activity('Quote Accepted', f"Client {current_user.email} accepted Quote {quote.quote_number}", tenant_id=quote.tenant_id)
    elif action == 'reject':
        quote.status = 'Rejected'
        log_activity('Quote Rejected', f"Client {current_user.email} rejected Quote {quote.quote_number}", tenant_id=quote.tenant_id)
    else:
        return jsonify({"message": "Invalid action"}), 400

    db.session.commit()
    return jsonify({"message": f"Quote {action}ed successfully"})

from datetime import datetime 

@bp.route('/api/bookings', methods=['POST'])
@login_required
def create_booking():
    if not check_client_access(): return jsonify({"message": "Unauthorized"}), 403
    
    data = request.json
    service_type = data.get('service_type')
    frequency = data.get('frequency')
    notes = data.get('notes')
    date_str = data.get('date')
    time_str = data.get('time')
    
    if not service_type or not date_str:
        return jsonify({"message": "Service and Date are required"}), 400

    try:
        # Link to the user's associated tenant (Business-in-a-Box context)
        # We look for a profile linked to a tenant. 
        business_profile = next((p for p in current_user.profiles if p.tenant_id is not None), None)
        tenant_id = business_profile.tenant_id if business_profile else None

        # Use personal profile for contact details
        personal_profile = next((p for p in current_user.profiles if p.tenant_id is None), None)
        
        new_req = QuoteRequest(
            user_id=current_user.id,
            tenant_id=tenant_id,
            primary_service=service_type,
            service_frequency=frequency,
            description=f"{notes} (Requested for {date_str} {time_str})",
            request_date=datetime.utcnow(),
            status='Pending',
            # Populate contact info from User/Profile
            name=personal_profile.full_name if personal_profile else current_user.email,
            email=current_user.email,
            phone=personal_profile.phone_number if personal_profile else None,
            address=personal_profile.address if personal_profile else None
        )
        
        db.session.add(new_req)
        db.session.commit()
        
        log_activity('New Booking Request', f"Client {current_user.email} requested {service_type}", tenant_id=tenant_id)
        
        return jsonify({"message": "Booking request submitted successfully"}), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating booking: {e}")
        return jsonify({"message": "Error processing request"}), 500

@bp.route('/', defaults={'path': ''})
@bp.route('/<path:path>')
@login_required
def client_spa_shell(path):
    if not check_client_access():
        return render_template('errors/403.html'), 403
    return render_template('client/client_dashboard.html', user=current_user)