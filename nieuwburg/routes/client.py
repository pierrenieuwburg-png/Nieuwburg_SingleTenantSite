from flask import Blueprint, jsonify, request, render_template, Response, current_app, url_for
from flask_login import login_required, current_user
from sqlalchemy.orm import joinedload
from ..models import QuoteRequest, Quote, Invoice, Job, Profile, BusinessSettings, MarketplaceService
from .. import db
from .utils import dispatch_live_job
from datetime import datetime
import os
import requests

# --- NEW IMPORTS from utils (Ensure these exist in routes/utils.py) ---
from .utils import render_template_to_pdf, log_activity, resolve_price_for_job

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
    
    # Get all client requests
    requests = QuoteRequest.query.filter_by(user_id=current_user.id).order_by(QuoteRequest.request_date.desc()).all()
    
    # Get all client quotes. Since we killed 'Draft', we just grab everything linked to them.
    formal_quotes = Quote.query.filter_by(user_id=current_user.id).order_by(Quote.quote_date.desc()).all()
    
    combined_data = []
    for r in requests:
        combined_data.append({
            "id": r.id, "type": "request", "display_id": f"REQ-{r.id}",
            "service_title": r.primary_service or "General Request",
            "description": r.description,
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
            "status": q.status, "amount": q.total, 
            "is_actionable": q.status == 'Pending' # Now looks for Pending!
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
    action = data.get('action') 
    notes = data.get('notes', '').strip()
    
    quote = Quote.query.filter_by(id=quote_id, user_id=current_user.id).first()
    if not quote:
        return jsonify({"message": "Quote not found"}), 404

    # Target the new 'Pending' status (or Viewed if they opened it)
    if quote.status not in ['Pending', 'Viewed']:
        return jsonify({"message": f"Cannot change status of a {quote.status} quote."}), 400

    if action == 'accept':
        quote.status = 'Accepted'
        
        # 1. Close the original Request so no other providers quote on it
        if quote.quote_request_id:
            quote_req = QuoteRequest.query.get(quote.quote_request_id)
            if quote_req:
                quote_req.status = 'Closed'
            
            # Eliminate competing quotes for this request (Multi-Tenant readiness)
            other_quotes = Quote.query.filter(
                Quote.quote_request_id == quote.quote_request_id,
                Quote.id != quote.id
            ).all()
            for oq in other_quotes:
                oq.status = 'Rejected (Lost)'

        # 2. Deposit/Payment Calculation
        settings = BusinessSettings.query.filter_by(tenant_id=quote.tenant_id).first()
        deposit_pct = settings.deposit_percentage if settings and settings.require_deposit else 100
        threshold = settings.large_job_threshold if settings else 0
        
        amount_to_pay = quote.total
        is_deposit = False
        if quote.total >= threshold and deposit_pct < 100:
            amount_to_pay = quote.total * (deposit_pct / 100.0)
            is_deposit = True

        log_msg = f"Client {current_user.email} accepted Quote {quote.quote_number}."
        if notes: log_msg += f" Client Notes: '{notes}'"
        log_activity('Quote Accepted', log_msg, tenant_id=quote.tenant_id)
        
        db.session.commit()
        
        # Send data back to trigger Paystack directly, without generating an Invoice
        return jsonify({
            "message": "Quote accepted. Proceeding to payment.", 
            "quote_id": quote.id,
            "quote_number": quote.quote_number,
            "amount_to_pay": amount_to_pay,
            "is_deposit": is_deposit,
            "email": current_user.email
        })

    elif action == 'reject':
        quote.status = 'Rejected'
        log_activity('Quote Rejected', f"Client {current_user.email} rejected Quote {quote.quote_number}", tenant_id=quote.tenant_id)
        db.session.commit()
        return jsonify({"message": "Quote rejected successfully"})

    return jsonify({"message": "Invalid action"}), 400

@bp.route('/api/bookings', methods=['POST'])
@login_required
def create_booking():
    if not check_client_access(): return jsonify({"message": "Unauthorized"}), 403
    
    data = request.json
    service_type = data.get('service_type') # platform Quick Book service NAME (e.g. 'Cleaning')
    date_str = data.get('date')
    time_str = data.get('time')
    notes = data.get('notes', '')
    frequency = data.get('frequency')  # captured onto the Job for pricing (F2/#7)

    # Grab map coordinates
    lat = data.get('latitude')
    lng = data.get('longitude')

    if not service_type or not date_str:
        return jsonify({"message": "Service and Date are required"}), 400

    try:
        # Resolve the PLATFORM Quick Book catalogue item (F2/#7) by the booked name,
        # and store it + the chosen frequency on the Job so resolve_price_for_job can
        # price it. NOTE: this replaces a previously-broken per-tenant ServiceItem
        # lookup (ServiceItem was never imported here -> create_booking raised
        # NameError on every call). The per-tenant ServiceItem is NOT the Quick Book
        # catalogue, so service_id stays None pre-match.
        mkt_service = MarketplaceService.query.filter_by(
            name=service_type, is_quick_bookable=True, is_active=True
        ).first()

        # Create a Job with NO tenant yet (Status = Searching)
        new_job = Job(
            client_id=current_user.id,
            tenant_id=None, # Remains None until a Pro accepts it!
            service_id=None,  # per-tenant ServiceItem link N/A for a platform Quick Book job
            marketplace_service_id=mkt_service.id if mkt_service else None,
            frequency=frequency,
            scheduled_date=datetime.strptime(date_str, "%Y-%m-%d").date(),
            start_time=datetime.strptime(time_str, "%H:%M").time() if time_str else None,
            status=Job.STATUS_SEARCHING,
            notes=f"{notes} (Awaiting Pro Match)",
            latitude=lat,
            longitude=lng
        )
        
        db.session.add(new_job)
        db.session.flush() # Get the new_job.id immediately
        
        log_activity('Searching for Pro', f"Client requested {service_type}. Engine searching...", user_id=current_user.id)
        
        # FIRE THE UBER ENGINE!
        from .utils import dispatch_live_job
        dispatch_live_job(new_job)
        db.session.commit()
        
        # Return the Job ID so React can listen to the specific 'client_job_{id}' room
        return jsonify({
            "message": "Searching for nearby pros...", 
            "job_id": new_job.id
        }), 201
        
    except Exception as e:
        db.session.rollback()
        print(f"Error creating booking: {e}")
        return jsonify({"message": "Error processing request"}), 500


@bp.route('/api/jobs/<int:job_id>/initiate-payment', methods=['POST'])
@login_required
def initiate_quick_book_payment(job_id):
    """Start a Paystack transaction for a matched Quick Book job and record the
    reference ON the job so the webhook can locate it (P1-3). Refuses unless the
    job is the caller's own, is awaiting payment, and has a usable price."""
    if not check_client_access():
        return jsonify({"message": "Unauthorized"}), 403

    # Ownership: the job must belong to the logged-in client.
    job = Job.query.filter_by(id=job_id, client_id=current_user.id).first()
    if not job:
        return jsonify({"message": "Job not found."}), 404

    # State: only a matched-but-unpaid Quick Book job can be paid for.
    if job.status != Job.STATUS_AWAITING_PAYMENT:
        return jsonify({"message": "This job is not awaiting payment."}), 400

    # Price: resolved from the job via the single seam. No usable price -> REFUSE
    # (create no Paystack transaction, set no payment_reference, charge nothing).
    amount = resolve_price_for_job(job)
    if amount is None:
        return jsonify({
            "message": "This service is not yet available for instant booking (no price set)."
        }), 400

    try:
        paystack_secret = os.environ.get('PAYSTACK_SECRET_KEY')
        url = "https://api.paystack.co/transaction/initialize"
        headers = {
            "Authorization": f"Bearer {paystack_secret}",
            "Content-Type": "application/json"
        }
        amount_cents = int(round(amount * 100))

        payload = {
            "email": current_user.email,
            "amount": amount_cents,
            "callback_url": url_for('main.payment_callback', _external=True),
            "metadata": {
                "type": "quick_book",
                "job_id": job.id
            }
        }

        response = requests.post(url, headers=headers, json=payload)
        response_data = response.json()

        if not response_data.get('status'):
            raise Exception(response_data.get('message'))

        # Record the reference so the webhook can locate THIS job by it.
        job.payment_reference = response_data['data']['reference']
        db.session.commit()

        return jsonify({
            "authorization_url": response_data['data']['authorization_url']
        })

    except Exception as e:
        db.session.rollback()
        print(f"Quick Book Payment Init Error: {e}")
        return jsonify({"message": "Could not initialize payment"}), 500


@bp.route('/api/requests/custom', methods=['POST'])
@login_required
def create_custom_request():
    if not check_client_access(): return jsonify({"message": "Unauthorized"}), 403
    
    # Retrieve form data
    service_type = request.form.get('service_type', 'Custom Service')
    property_type = request.form.get('property_type', 'Residential')
    urgency = request.form.get('urgency', 'Flexible')
    budget = request.form.get('budget', 0)
    description = request.form.get('description', '')

    # 1. Handle Photo Uploads
    uploaded_photos = request.files.getlist('photos')
    saved_filenames = []
    
    if uploaded_photos:
        os.makedirs(os.path.join(current_app.config['UPLOAD_FOLDER'], 'requests'), exist_ok=True)
        for file in uploaded_photos:
            if file and file.filename != '':
                filename = secure_filename(file.filename)
                unique_filename = f"req_{current_user.id}_{uuid.uuid4().hex[:8]}_{filename}"
                upload_path = os.path.join(current_app.config['UPLOAD_FOLDER'], 'requests', unique_filename)
                
                try:
                    file.save(upload_path)
                    saved_filenames.append(f"requests/{unique_filename}")
                except Exception as e:
                    print(f"Error saving photo: {e}")

    try:
        # Get profiles to assign proper tenant context
        business_profile = next((p for p in current_user.profiles if p.tenant_id is not None), None)
        tenant_id = business_profile.tenant_id if business_profile else None
        personal_profile = next((p for p in current_user.profiles if p.tenant_id is None), None)

        # 2. Compile description block for the Admin Panel
        formatted_budget = f"R {int(budget):,}" if int(budget) > 0 else "Unsure"
        full_desc = f"Urgency: {urgency}\nBudget Estimate: {formatted_budget}\n\nClient Notes:\n{description}"

        # 3. Create the Database Record
        new_req = QuoteRequest(
            user_id=current_user.id,
            tenant_id=tenant_id,
            primary_service=service_type,
            property_type=property_type,
            service_frequency='Once-off',
            description=full_desc,
            request_date=datetime.utcnow(),
            status='Pending',
            name=personal_profile.full_name if personal_profile else current_user.email,
            email=current_user.email,
            phone=personal_profile.phone_number if personal_profile else None,
            address=personal_profile.address if personal_profile else None,
            service_details=json.dumps({"photos": saved_filenames}) 
        )

        db.session.add(new_req)
        db.session.commit()

        log_activity('New Custom Request', f"Client {current_user.email} submitted a custom quote request for {service_type}", tenant_id=tenant_id)

        return jsonify({"message": "Custom request submitted successfully"}), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error creating custom request: {e}")
        return jsonify({"message": "Error processing request"}), 500
    
# --- REQUEST MANAGEMENT ROUTES ---

@bp.route('/api/requests/<int:request_id>', methods=['DELETE'])
@login_required
def delete_quote_request(request_id):
    if not check_client_access(): return jsonify({"message": "Unauthorized"}), 403
    
    # Ensure the request belongs to the current user
    req = QuoteRequest.query.filter_by(id=request_id, user_id=current_user.id).first()
    if not req:
        return jsonify({"message": "Request not found"}), 404
        
    try:
        db.session.delete(req)
        db.session.commit()
        log_activity('Request Deleted', f"Client {current_user.email} deleted Request REQ-{request_id}", tenant_id=req.tenant_id)
        return jsonify({"message": "Request deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting request: {e}")
        return jsonify({"message": "Error deleting request"}), 500

@bp.route('/api/requests/<int:request_id>', methods=['PUT'])
@login_required
def update_quote_request(request_id):
    if not check_client_access(): return jsonify({"message": "Unauthorized"}), 403
    
    # Ensure the request belongs to the current user
    req = QuoteRequest.query.filter_by(id=request_id, user_id=current_user.id).first()
    if not req:
        return jsonify({"message": "Request not found"}), 404
        
    # Prevent editing if it's already being processed
    if req.status != 'Pending':
        return jsonify({"message": "Cannot edit a request that is no longer pending."}), 400
        
    data = request.json
    
    try:
        req.primary_service = data.get('primary_service', req.primary_service)
        req.description = data.get('description', req.description)
        # You can add other fields here if you expand the edit form (e.g. frequency)
        
        db.session.commit()
        log_activity('Request Updated', f"Client {current_user.email} updated Request REQ-{request_id}", tenant_id=req.tenant_id)
        return jsonify({"message": "Request updated successfully"}), 200
    except Exception as e:
        db.session.rollback()
        print(f"Error updating request: {e}")
        return jsonify({"message": "Error updating request"}), 500

@bp.route('/', defaults={'path': ''})
@bp.route('/<path:path>')
@login_required
def client_spa_shell(path):
    if not check_client_access():
        return render_template('errors/403.html'), 403
    return render_template('client/client_dashboard.html', user=current_user)