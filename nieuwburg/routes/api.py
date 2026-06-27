from flask import Blueprint, jsonify, request, current_app, flash, render_template, redirect, url_for, flash, Response
from flask_login import login_required, current_user
from flask_socketio import join_room
from sqlalchemy.orm import joinedload
from sqlalchemy.orm.attributes import flag_modified
from itsdangerous import URLSafeTimedSerializer
from threading import Thread
import secrets
import json
import requests
import pytz
import os
import uuid
import traceback
from .admin import admin_required
from ..forms import GuestQuoteForm
from .utils import get_next_quote_number, log_activity, send_async_email, render_template_to_pdf, send_email_with_attachment, get_next_invoice_number
from markupsafe import escape, Markup
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash
from datetime import date, datetime, time, timedelta
from .. import db, socketio
from ..models import (Post, LeadDispatch, ServiceCategory, ServiceItem, Job, User, Profile, 
                      QuoteRequest, Quote, StaffApplication, QuoteLineItem, 
                      ActivityLog, Invoice, BusinessSettings, ServiceClause, Tenant, InvoiceLineItem, JobTask, JobPhoto)

from ..forms import AddClientForm, AddStaffForm, EditStaffForm, EditClientForm
from .auth import generate_confirmation_token
from .. import mail
from flask_mail import Message

bp = Blueprint('api', __name__, url_prefix='/api')

def nl2br(value):
    """Converts newlines in text to HTML <br> tags."""
    if value is None:
        return ''
    escaped_value = escape(str(value)) 
    result = escaped_value.replace('\r\n', '<br>\n').replace('\n', '<br>\n')
    return Markup(result)

# --- Add Client API Route ---
@bp.route('/admin/clients', methods=['POST'])
@login_required
def api_add_client():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
    data = request.json
    form = AddClientForm(data=data) 
    if form.validate():
        email = form.email.data.lower().strip()
        existing_user = User.query.filter_by(email=email).first()
        
        if existing_user:
            existing_tenant_profile = Profile.query.filter_by(user_id=existing_user.id, tenant_id=current_user.tenant_id).first()
            if existing_tenant_profile:
                return jsonify({'message': 'This client is already in your list.'}), 409
            
            # Clone: Create new profile for tenant
            new_tenant_profile = Profile(user_id=existing_user.id, full_name=form.full_name.data, phone_number=form.phone_number.data, address=form.address.data, tenant_id=current_user.tenant_id)
            db.session.add(new_tenant_profile)
            db.session.commit()
            log_activity('Client Added', f"Admin added existing user {email} to their client list.")
            return jsonify({'message': 'Client added successfully!'}), 201
        else:
            try:
                new_client = User(email=email, role='client', is_confirmed=True, tenant_id=None)
                new_client.set_password(secrets.token_urlsafe(12))
                db.session.add(new_client)
                db.session.flush()
                new_tenant_profile = Profile(user_id=new_client.id, full_name=form.full_name.data, phone_number=form.phone_number.data, address=form.address.data, tenant_id=current_user.tenant_id)
                db.session.add(new_tenant_profile)
                db.session.commit()
                log_activity('Client Created', f"Admin created new client: {email}")
                return jsonify({'message': 'Client added successfully!'}), 201 
            except Exception as e:
                db.session.rollback()
                return jsonify({'message': 'Database error.'}), 500
    else:
        return jsonify({'message': 'Validation failed'}), 400
    
@bp.route('/admin/clients/<int:user_id>', methods=['PUT']) 
@login_required
def update_client_details(user_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
    profile = Profile.query.filter_by(user_id=user_id, tenant_id=current_user.tenant_id).first()
    if not profile:
        return jsonify({"message": "Client profile not found"}), 404
    
    data = request.json
    profile.full_name = data.get('full_name', profile.full_name)
    profile.phone_number = data.get('phone_number', profile.phone_number)
    profile.address = data.get('address', profile.address)
    profile.service_frequency = data.get('service_frequency', profile.service_frequency)
    service_fee_input = data.get('service_fee', profile.service_fee)
    try:
         profile.service_fee = float(service_fee_input) if service_fee_input not in [None, ''] else None
    except (ValueError, TypeError):
         profile.service_fee = profile.service_fee 
    profile.notes = data.get('notes', profile.notes)

    try:
        db.session.commit()
        log_activity('Client Updated (API)', f"Admin '{current_user.email}' updated profile for {profile.user.email}")
        updated_data = get_client_details(user_id).get_json()
        return jsonify({"message": "Client profile updated.", "client": updated_data})
    except Exception as e:
        db.session.rollback()
        return jsonify({'message': f'Database error occurred: {e}'}), 500

@bp.route('/admin/clients/delete/<int:user_id>', methods=['POST'])
@login_required
def api_delete_client(user_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    # Ensure the CSRF token is checked, matching the frontend request
    csrf_token = request.headers.get('X-CSRFToken')
    if not csrf_token:
        return jsonify({"message": "CSRF token missing"}), 400

    try:
        # First, find the specific profile linked to this tenant
        profile = Profile.query.filter_by(user_id=user_id, tenant_id=current_user.tenant_id).first()
        
        if not profile:
            return jsonify({"message": "Client not found in your list."}), 404

        # Important Multi-Tenant Consideration: 
        # If this is a true single-tenant app now, you might want to delete the User record as well.
        # However, deleting just the Profile unlinks them from THIS business, which is safer if
        # the User account might be used elsewhere or if you want to keep the base record.
        # Given your previous `routes/admin.py` deleted the User, let's replicate that logic safely.

        client_user = db.session.get(User, user_id)
        if client_user and client_user.role == 'client':
             # We delete the User. SQLAlchemy cascading should handle the Profile.
             db.session.delete(client_user)
             db.session.commit()
             
             # Assuming 'log_activity' is imported from .utils at the top of api.py
             from .utils import log_activity 
             log_activity('Client Deleted', f"Admin '{current_user.email}' deleted client ID {user_id}.")
             
             return jsonify({"message": "Client deleted successfully."}), 200
        else:
             return jsonify({"message": "Invalid user record."}), 400

    except Exception as e:
        db.session.rollback()
        print(f"Error deleting client {user_id}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"An internal error occurred: {str(e)}"}), 500
    
@bp.route('/admin/dashboard-stats', methods=['GET'])
@login_required
def get_dashboard_stats():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    try:
        today = date.today()
        
        # 1. New Quotes (remains the same)
        new_quotes_count = QuoteRequest.query.filter_by(
            status='Pending', # Changed from 'New' to 'Pending' to match likely status
            tenant_id=current_user.tenant_id
        ).count()

        # 2. Upcoming Jobs (remains the same)
        upcoming_cleans_count = Job.query.filter(
            Job.scheduled_date >= today,
            Job.status.in_(['Scheduled', 'In-Progress']),
            Job.tenant_id == current_user.tenant_id
        ).count()
        
        # 3. FIX: Count PROFILES instead of USERS
        # We join User to ensure we only count actual 'client' roles, not staff profiles
        active_clients_count = Profile.query.join(User).filter(
            User.role == 'client',
            Profile.tenant_id == current_user.tenant_id
        ).count()
        
        # 4. Staff Members (remains the same)
        staff_members_count = User.query.filter_by(
            role='staff', 
            tenant_id=current_user.tenant_id
        ).count()

        stats_data = {
            "new_quotes_count": new_quotes_count,
            "upcoming_cleans_count": upcoming_cleans_count,
            "active_clients_count": active_clients_count,
            "staff_members_count": staff_members_count
        }
        return jsonify(stats_data)
    except Exception as e:
        print(f"Error fetching dashboard stats: {e}")
        return jsonify({"message": "Error fetching dashboard statistics."}), 500
    
@bp.route('/admin/jobs/by_date/<string:date_str>', methods=['GET'])
@login_required
def get_jobs_by_date(date_str):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    try:
        target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return jsonify({"message": "Invalid date format. Use YYYY-MM-DD."}), 400

    try:
        jobs_on_date = Job.query.options(
            joinedload(Job.client).joinedload(User.profile),
            joinedload(Job.assigned_staff).joinedload(User.profile),
            joinedload(Job.quote_request)
        ).filter(
            Job.scheduled_date == target_date,
            Job.tenant_id == current_user.tenant_id # <--- TENANT AWARE
        ).order_by(Job.start_time.asc()).all()

        jobs_data = []
        for job in jobs_on_date:
            client_name = "N/A"
            if job.client and job.client.profile:
                client_name = job.client.profile.full_name or job.client.email
            elif job.client:
                 client_name = job.client.email

            service_name = job.quote_request.primary_service if job.quote_request else "N/A"

            staff_names = ", ".join(
                [staff.profile.full_name for staff in job.assigned_staff if staff.profile and staff.profile.full_name]
            ) or 'N/A'

            jobs_data.append({
                "id": job.id,
                "client_name": client_name,
                "service_name": service_name,
                "start_time": job.start_time.strftime('%H:%M') if job.start_time else '--:--',
                "assigned_staff": staff_names,
                "status": job.status
            })

        return jsonify(jobs_data)

    except Exception as e:
        print(f"Error fetching jobs for date {date_str}: {e}")
        traceback.print_exc()
        return jsonify({"message": f"An internal server error occurred: {str(e)}"}), 500
    
@bp.route('/admin/quotes/<int:quote_id>', methods=['GET'])
@login_required
def get_quote_detail(quote_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    try:
        # DIAGNOSTIC/MVP MODE: Strip Tenant Filter
        quote = QuoteRequest.query.filter_by(id=quote_id).first()
        
        if not quote:
            return jsonify({"message": "Quote request not found"}), 404

        sast_timezone = pytz.timezone('Africa/Johannesburg')
        formatted_date = 'N/A'
        if quote.request_date:
            utc_dt = pytz.utc.localize(quote.request_date)
            sast_dt = utc_dt.astimezone(sast_timezone)
            formatted_date = sast_dt.strftime('%d %b %Y, %H:%M')

        client_data = {
            "name": quote.name or 'N/A',
            "email": quote.email or 'N/A',
            "phone": quote.phone or 'N/A',
            "address": quote.address or 'Not provided',
            "user_id": quote.user_id 
        }

        request_data = {
            "id": quote.id,
            "submitted_on": formatted_date,
            "status": quote.status or 'Unknown',
            "subject": quote.subject or 'N/A',
            "associated_email": quote.user.email if quote.user else 'No associated account',
            "full_description": quote.description or 'No description provided.'
        }

        return jsonify({
            "client": client_data,
            "request": request_data
        })
    
    except Exception as e:
        print(f"Error fetching quote detail {quote_id}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"An internal server error occurred: {str(e)}"}), 500
    
@bp.route('/admin/quotes/formal/<int:quote_id>', methods=['GET'])
@login_required
def get_formal_quote_detail(quote_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
    try:
        # TENANT AWARE
        quote = Quote.query.filter_by(
            id=quote_id,
            tenant_id=current_user.tenant_id
        ).first()

        if not quote:
            return jsonify({"message": "Formal quote not found"}), 404
            
        client_data = {
            "name": "N/A", "email": "N/A", "phone": "N/A", "address": "N/A",
            "user_id": quote.user_id
        }
        if quote.user:
            if quote.user.profile:
                client_data["name"] = quote.user.profile.full_name or quote.user.email
                client_data["email"] = quote.user.email
                client_data["phone"] = quote.user.profile.phone_number
                client_data["address"] = quote.user.profile.address
            else:
                client_data["name"] = quote.user.email
                client_data["email"] = quote.user.email
        elif quote.guest_name:
            client_data["name"] = quote.guest_name
            client_data["email"] = quote.guest_email
            client_data["phone"] = quote.guest_phone
            client_data["address"] = quote.guest_address

        quote_data = {
            "id": quote.id, "quote_number": quote.quote_number,
            "quote_date": quote.quote_date.strftime('%d %b %Y') if quote.quote_date else 'N/A',
            "expiry_date": quote.expiry_date.strftime('%d %b %Y') if quote.expiry_date else 'N/A',
            "status": quote.status, "subtotal": quote.subtotal,
            "discount": quote.discount_value, "total": quote.total,
            "terms_and_conditions": quote.terms_and_conditions,
            "business_address": quote.business_address,
            "registration_number": quote.registration_number
        }
        
        # Line items are safe because they belong to the Quote, which we already verified
        line_items = QuoteLineItem.query.filter_by(quote_id=quote_id).all()
        items_data = [{
            "id": item.id, 
            "description": item.description, 
            "quantity": item.quantity,
            "unit_price": item.unit_price, 
            "amount": item.amount,
            "service_item_id": item.service_item_id 
        } for item in line_items]

        return jsonify({
            "client": client_data,
            "quote": quote_data,
            "line_items": items_data
        })
    
    except Exception as e:
        print(f"Error fetching formal quote detail {quote_id}: {e}")
        traceback.print_exc()
        return jsonify({"message": f"An internal server error occurred: {str(e)}"}), 500
    
@bp.route('/admin/quotes/<int:quote_id>', methods=['PUT'])
@login_required
def api_update_quote(quote_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    # TENANT AWARE
    quote = Quote.query.filter_by(
        id=quote_id,
        tenant_id=current_user.tenant_id
    ).first()

    if not quote:
        return jsonify({"message": "Quote not found"}), 404

    if quote.status != 'Draft':
        return jsonify({
            "message": f"Quote is in '{quote.status}' status and can no longer be edited."
        }), 403

    data = request.get_json()
    if not data:
        return jsonify({"message": "No data provided."}), 400

    line_items = data.get('line_items', [])
    if not line_items:
         return jsonify({"message": "At least one line item is required."}), 400

    try:
        quote.user_id = data.get('client_id')
        quote.guest_name = data.get('guest_name')
        quote.guest_email = data.get('email')
        quote.guest_phone = data.get('phone_number')
        quote.guest_address = data.get('address')
        
        quote.subtotal = data.get('subtotal')
        quote.discount_value = data.get('discount')
        quote.total = data.get('total')
        
        QuoteLineItem.query.filter_by(quote_id=quote_id).delete()

        for item in line_items:
            line_item = QuoteLineItem(
                quote_id=quote.id,
                description=item.get('description'),
                quantity=float(item.get('quantity', 0)),
                unit_price=float(item.get('unit_price', 0)),
                amount=(float(item.get('quantity', 0)) * float(item.get('unit_price', 0))),
                service_item_id=item.get('service_item_id') 
            )
            db.session.add(line_item)

        log_activity(
            'Quote Updated',
            f"Admin '{current_user.email}' updated quote {quote.quote_number}."
        )
        db.session.commit()
        
        return jsonify({
            "message": f"Quote {quote.quote_number} updated successfully!",
            "quote_id": quote.id
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error updating quote: {e}")
        traceback.print_exc()
        return jsonify({"message": f"An internal server error occurred: {str(e)}"}), 500
    
@bp.route('/admin/business-settings', methods=['GET', 'PUT'])
@login_required
def api_business_settings():
    """
    Handles fetching and updating the TENANT-SPECIFIC business settings.
    """
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    # TENANT AWARE: Fetch settings for THIS tenant
    settings = BusinessSettings.query.filter_by(tenant_id=current_user.tenant_id).first()
    
    if not settings:
        # Initialize if not found (shouldn't happen after setup wizard, but good safety)
        settings = BusinessSettings(tenant_id=current_user.tenant_id)
        db.session.add(settings)
        db.session.commit()

    if request.method == 'PUT':
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided"}), 400
        
        try:
            settings.business_name = data.get('business_name', settings.business_name)
            settings.business_address = data.get('business_address', settings.business_address)
            settings.registration_number = data.get('registration_number', settings.registration_number)
            settings.default_terms = data.get('default_terms', settings.default_terms)
            
            db.session.commit()
            log_activity('Settings Updated', f"Admin '{current_user.email}' updated business settings.")
            
            return jsonify({
                "message": "Business settings updated successfully!",
                "settings": {
                    "business_name": settings.business_name,
                    "business_address": settings.business_address,
                    "registration_number": settings.registration_number,
                    "default_terms": settings.default_terms
                }
            })
        except Exception as e:
            db.session.rollback()
            print(f"Error updating settings: {e}")
            return jsonify({"message": f"An error occurred: {str(e)}"}), 500

    # --- GET Request ---
    return jsonify({
        "business_name": settings.business_name,
        "business_address": settings.business_address,
        "registration_number": settings.registration_number,
        "default_terms": settings.default_terms
    })
    
@bp.route('/admin/quotes/download/<int:item_id>', methods=['GET'])
@login_required
def api_download_quote(item_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    item_type = request.args.get('type')
    logo_path = os.path.join(current_app.root_path, 'static', 'img', 'LogoBlackWithTitle.png')

    try:
        filename = "document.pdf"
        pdf_data = None

        if item_type == 'request':
            # TENANT AWARE
            quote_req = db.session.query(QuoteRequest).options(
                joinedload(QuoteRequest.user).joinedload(User.profile)
            ).filter_by(
                id=item_id,
                tenant_id=current_user.tenant_id
            ).first()
            
            if not quote_req:
                return "Quote Request not found", 404
            
            pdf_data = render_template_to_pdf(
                'public/quote_pdf_template.html', 
                quote=quote_req,
                logo_url=logo_path
            )
            filename = f"Quote_Request_{quote_req.id}.pdf"

        elif item_type == 'quote':
            # TENANT AWARE
            quote = db.session.query(Quote).options(
                joinedload(Quote.line_items),
                joinedload(Quote.user).joinedload(User.profile)
            ).filter_by(
                id=item_id,
                tenant_id=current_user.tenant_id
            ).first()
            
            if not quote:
                return "Formal Quote not found", 404
            
            pdf_data = render_template_to_pdf(
                'public/quote_pdf_template.html', 
                quote=quote,
                logo_url=logo_path
            )
            filename = f"Quote_{quote.quote_number}.pdf"
        
        else:
            return "Invalid item type provided.", 400

        return Response(
            pdf_data,
            mimetype='application/pdf',
            headers={'Content-Disposition': f'attachment;filename={filename}'}
        )

    except Exception as e:
        print(f"Error generating PDF for item {item_id} (type: {item_type}): {e}")
        traceback.print_exc()
        return "An internal server error occurred.", 500
    
@bp.route('/admin/quotes/<int:quote_id>/send', methods=['POST'])
@login_required
def api_send_quote(quote_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    csrf_token = request.headers.get('X-CSRFToken')
    if not csrf_token:
        return jsonify({"message": "CSRF token missing"}), 400

    # TENANT AWARE
    quote = QuoteRequest.query.filter_by(
        id=quote_id,
        tenant_id=current_user.tenant_id
    ).first()

    if not quote:
        return jsonify({"message": "Quote not found"}), 404

    if quote.status in ['Accepted', 'Rejected']:
        return jsonify({"message": f"Quote is already {quote.status} and cannot be sent."}), 400

    recipient_email = quote.email
    if not recipient_email and quote.user and quote.user.email:
        recipient_email = quote.user.email

    if not recipient_email:
        return jsonify({"message": "Cannot send quote: No email address found for this client."}), 400

    try:
        pdf_data = render_template_to_pdf(
            'public/quote_pdf_template.html', 
            quote=quote
        )
        
        # Note: get_quote_token implies public access. 
        # Ensure the public access route doesn't require login but verifies token validity.
        token = quote.get_quote_token() 
        email_html = render_template(
            'email/quote_ready.html', 
            quote=quote, 
            token=token
        )

        pdf_filename = f"Quote_{quote.quote_number}.pdf"
        send_email_with_attachment(
            subject=f"Your Quote from Nieuwburg Blitz ({quote.quote_number})",
            recipients=[recipient_email],
            html_body=email_html,
            attachment_data=pdf_data,
            attachment_filename=pdf_filename,
            attachment_mimetype='application/pdf'
        )

        quote.status = 'Sent'
        log_activity(
            'Quote Sent', 
            f"Admin '{current_user.email}' sent quote {quote.quote_number} to {recipient_email}."
        )
        db.session.commit()

        return jsonify({
            "message": f"Quote {quote.quote_number} successfully sent to {recipient_email}.",
            "new_status": "Sent"
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error sending quote {quote_id}: {e}")
        traceback.print_exc()
        return jsonify({"message": f"An internal server error occurred: {str(e)}"}), 500
    
@bp.route('/admin/quotes/<int:item_id>', methods=['DELETE'])
@login_required
def api_delete_quote(item_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
        
    csrf_token = request.headers.get('X-CSRFToken')
    if not csrf_token:
        return jsonify({"message": "CSRF token missing"}), 400

    item_type = request.args.get('type')
    
    try:
        if item_type == 'request':
            # DIAGNOSTIC/MVP MODE: Strip Tenant Filter
            quote_req = QuoteRequest.query.filter_by(id=item_id).first()

            if not quote_req:
                return jsonify({"message": "Quote Request not found"}), 404
            
            item_desc = quote_req.subject or quote_req.name or f"Request #{quote_req.id}"
            db.session.delete(quote_req)
            from .utils import log_activity
            log_activity(
                'Quote Request Deleted',
                f"Admin '{current_user.email}' deleted quote request: {item_desc} (ID: {item_id})."
            )
            
        elif item_type == 'quote':
            # DIAGNOSTIC/MVP MODE: Strip Tenant Filter
            quote = Quote.query.filter_by(id=item_id).first()

            if not quote:
                return jsonify({"message": "Formal Quote not found"}), 404
            
            item_desc = quote.quote_number or f"Quote #{quote.id}"
            
            QuoteLineItem.query.filter_by(quote_id=item_id).delete()
            db.session.delete(quote)
            
            from .utils import log_activity
            log_activity(
                'Quote Deleted',
                f"Admin '{current_user.email}' deleted quote: {item_desc} (ID: {item_id})."
            )
        
        else:
            return jsonify({"message": "Invalid item type for deletion."}), 400

        db.session.commit()
        return jsonify({"message": f"{item_desc.title()} has been deleted."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error deleting quote item {item_id} (type: {item_type}): {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": f"An internal server error occurred: {str(e)}"}), 500
    
@bp.route('/admin/quotes/create', methods=['POST'])
@login_required
def api_create_quote():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    data = request.get_json()
    if not data: return jsonify({"message": "No data provided."}), 400
    if not data.get('line_items'): return jsonify({"message": "At least one line item is required."}), 400

    try:
        settings = BusinessSettings.query.filter_by(tenant_id=current_user.tenant_id).first()
        if not settings: 
             settings = BusinessSettings(tenant_id=current_user.tenant_id) 

        # 1. Create Quote directly as 'Pending'
        new_quote = Quote(
            quote_number=get_next_quote_number(), 
            user_id=data.get('client_id'),
            guest_name=data.get('guest_name'),
            guest_email=data.get('email'),
            guest_phone=data.get('phone_number'),
            guest_address=data.get('address'),
            
            subtotal=data.get('subtotal'),
            discount_value=data.get('discount'),
            total=data.get('total'),
            
            # BYPASS DRAFT: Straight to pending!
            status='Pending', 
            quote_date=date.today(),
            expiry_date=date.today() + timedelta(days=30),
            
            business_address=settings.business_address,
            registration_number=settings.registration_number,
            terms_and_conditions=settings.default_terms,
            
            tenant_id=current_user.tenant_id,
            quote_request_id=data.get('quote_request_id') # Link to the original request if provided
        )
        
        db.session.add(new_quote)
        db.session.flush() 

        for item in data.get('line_items', []):
            line_item = QuoteLineItem(
                quote_id=new_quote.id, 
                description=item.get('description'),
                quantity=float(item.get('quantity', 0)),
                unit_price=float(item.get('unit_price', 0)),
                amount=(float(item.get('quantity', 0)) * float(item.get('unit_price', 0))),
                service_item_id=item.get('service_item_id')
            )
            db.session.add(line_item)

        log_activity('Quote Sent', f"Admin '{current_user.email}' sent quote {new_quote.quote_number}.", tenant_id=current_user.tenant_id)
        db.session.commit()
        
        # 2. Smart Email Routing Logic
        recipient_email = new_quote.guest_email
        target_user = None

        if new_quote.user_id:
            target_user = User.query.get(new_quote.user_id)
            if target_user and target_user.email:
                recipient_email = target_user.email
        elif recipient_email:
            # Check if this guest email actually belongs to an existing user
            target_user = User.query.filter_by(email=recipient_email).first()

        if recipient_email:
            try:
                # Generate the PDF attachment
                pdf_data = render_template_to_pdf('public/quote_pdf_template.html', quote=new_quote)
                pdf_filename = f"Quote_{new_quote.quote_number}.pdf"
                
                # Determine Registration Status to set the right Call to Action
                needs_registration = True
                if target_user and target_user.password_hash and target_user.is_confirmed:
                    needs_registration = False

                # Pass this flag to your email template so it can show the correct button/link
                email_html = render_template(
                    'email/quote_ready.html', 
                    quote=new_quote, 
                    needs_registration=needs_registration,
                    login_url=url_for('auth.login', _external=True),
                    register_url=url_for('auth.register', email=recipient_email, _external=True)
                )
                
                send_email_with_attachment(
                    subject=f"Your Quote from {settings.business_name} ({new_quote.quote_number})",
                    recipients=[recipient_email],
                    html_body=email_html,
                    attachment_data=pdf_data,
                    attachment_filename=pdf_filename,
                    attachment_mimetype='application/pdf'
                )
            except Exception as email_err:
                print(f"Quote created but failed to auto-send email: {email_err}")

        return jsonify({
            "message": f"Quote {new_quote.quote_number} generated and sent to client!",
            "quote_id": new_quote.id
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error creating quote: {e}")
        return jsonify({"message": f"An internal server error occurred."}), 500
    
@bp.route('/admin/quotes/<int:quote_id>/convert-to-invoice', methods=['POST'])
@login_required
def api_convert_quote_to_invoice(quote_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    # 1. Fetch the Quote (Tenant Aware)
    quote = Quote.query.filter_by(
        id=quote_id,
        tenant_id=current_user.tenant_id
    ).first()

    if not quote:
        return jsonify({"message": "Quote not found."}), 404

    try:
        # --- FIX: Handle Guest Quotes (Missing user_id) ---
        final_user_id = quote.user_id
        
        if not final_user_id:
            # This is a guest quote. We must create a Client User for them.
            # Check if user exists by email first
            existing_user = User.query.filter_by(
                email=quote.guest_email, 
                tenant_id=current_user.tenant_id
            ).first()
            
            if existing_user:
                final_user_id = existing_user.id
            else:
                # Create new client user
                new_client = User(
                    email=quote.guest_email,
                    role='client',
                    is_confirmed=False, # They haven't logged in yet
                    tenant_id=current_user.tenant_id
                )
                # Set a random temp password
                new_client.set_password(secrets.token_urlsafe(12))
                
                new_profile = Profile(
                    user=new_client,
                    full_name=quote.guest_name or "Guest Client",
                    phone_number=quote.guest_phone,
                    address=quote.guest_address,
                    tenant_id=current_user.tenant_id
                )
                
                db.session.add(new_client)
                db.session.add(new_profile)
                db.session.flush() # Get the ID
                
                final_user_id = new_client.id
                
                # Link the original quote to this new user for future reference
                quote.user_id = final_user_id

        # 2. Create the Invoice Header
        new_invoice = Invoice(
            invoice_number=get_next_invoice_number(), 
            user_id=final_user_id, # Use the guaranteed ID
            tenant_id=current_user.tenant_id,
            invoice_date=date.today(),
            due_date=date.today() + timedelta(days=7),
            status='Unpaid',
            subtotal=quote.subtotal,
            discount_value=quote.discount_value,
            total=quote.total,
            payment_token=secrets.token_urlsafe(32)
        )
        
        db.session.add(new_invoice)
        db.session.flush() 

        # 3. Clone Line Items
        for q_item in quote.line_items:
            inv_item = InvoiceLineItem(
                invoice_id=new_invoice.id,
                description=q_item.description,
                quantity=q_item.quantity,
                unit_price=q_item.unit_price,
                amount=q_item.amount
            )
            db.session.add(inv_item)

        # 4. Update Quote Status
        quote.status = 'Invoiced'

        # 5. Log Activity
        log_activity(
            'Invoice Generated', 
            f"Admin converted Quote {quote.quote_number} to Invoice {new_invoice.invoice_number}."
        )

        db.session.commit()

        return jsonify({
            "message": f"Successfully created Invoice {new_invoice.invoice_number}",
            "invoice_id": new_invoice.id
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error converting quote to invoice: {e}")
        traceback.print_exc()
        return jsonify({"message": f"An internal error occurred: {str(e)}"}), 500
    
@bp.route('/admin/service-categories', methods=['POST'])
@login_required
def create_service_category():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
        
    data = request.get_json()
    name = data.get('name')
    
    if not name:
        return jsonify({"message": "Category name is required"}), 400
        
    try:
        # Check for duplicates within this tenant
        existing = ServiceCategory.query.filter_by(name=name, tenant_id=current_user.tenant_id).first()
        if existing:
            return jsonify({"message": "Category already exists"}), 400

        new_cat = ServiceCategory(
            name=name,
            description=data.get('description', ''),
            calculation_method=data.get('calculation_method', 'property_size'), # NEW
            prompt_question=data.get('prompt_question', ''), # NEW
            tenant_id=current_user.tenant_id
        )
        db.session.add(new_cat)
        db.session.commit()
        
        log_activity('Category Created', f"Admin created category: {name}")
        return jsonify({"id": new_cat.id, "name": new_cat.name, "message": "Category created"}), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 500

@bp.route('/admin/service-categories/<int:cat_id>', methods=['DELETE'])
@login_required
def delete_service_category(cat_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
        
    category = ServiceCategory.query.filter_by(id=cat_id, tenant_id=current_user.tenant_id).first()
    if not category:
        return jsonify({"message": "Category not found"}), 404
        
    try:
        db.session.delete(category)
        db.session.commit()
        log_activity('Category Deleted', f"Admin deleted category ID: {cat_id}")
        return jsonify({"message": "Category deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 500
    
@bp.route('/admin/service-categories', methods=['GET'])
@login_required
def get_service_categories():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
    
    try:
        # Fetch categories with items
        categories = ServiceCategory.query.options(
            joinedload(ServiceCategory.items).joinedload(ServiceItem.linked_clauses)
        ).filter_by(
            tenant_id=current_user.tenant_id
        ).order_by(ServiceCategory.name).all()
        
        categories_data = []
        for category in categories:
            items_data = []
            for item in category.items:
                
                items_data.append({
                    'id': item.id,
                    'name': item.name,
                    'description': item.description, 
                    'estimated_time_mins': item.estimated_time_mins,
                    'pricing_type': item.pricing_type, 
                    'default_rate': item.default_rate, 
                    'is_material': item.is_material,   
                    'is_variable_price': item.is_variable_price,
                    'is_extra': item.is_extra,
                    'default_checklist': item.default_checklist or [],
                    'category_id': item.category_id,
                    'linked_clause_ids': [c.id for c in item.linked_clauses]
                })
            
            categories_data.append({
                'id': category.id,
                'name': category.name,
                'description': category.description,
                'calculation_method': category.calculation_method, # NEW
                'prompt_question': category.prompt_question, # NEW
                'items': items_data
            })
            
        return jsonify(categories_data)
        
    except Exception as e:
        print(f"Error fetching service categories: {e}")
        traceback.print_exc()
        return jsonify({"message": "Error fetching service data."}), 500

@bp.route('/admin/service-items/<int:item_id>', methods=['GET'])
@login_required
def get_service_item(item_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
        
    try:
        # TENANT AWARE
        service_item = ServiceItem.query.options(
            joinedload(ServiceItem.linked_clauses)
        ).filter_by(
            id=item_id,
            tenant_id=current_user.tenant_id # <--- SECURITY
        ).first()
        
        if not service_item:
            return jsonify({"message": "Service item not found"}), 404
            
        linked_clause_ids = [clause.id for clause in service_item.linked_clauses]
        
        return jsonify({
            'id': service_item.id,
            'name': service_item.name,
            'estimated_time_mins': service_item.estimated_time_mins,
            'linked_clause_ids': linked_clause_ids 
        })
        
    except Exception as e:
        print(f"Error fetching service item {item_id}: {e}")
        traceback.print_exc()
        return jsonify({"message": "Error fetching service item."}), 500

@bp.route('/admin/service-items', methods=['POST'])
@login_required
def create_service_item():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
        
    data = request.get_json()
    if not data.get('name') or not data.get('category_id'):
        return jsonify({"message": "Name and Category are required"}), 400
        
    try:
        category = ServiceCategory.query.filter_by(id=data['category_id'], tenant_id=current_user.tenant_id).first()
        if not category:
            return jsonify({"message": "Invalid Category"}), 400

        new_item = ServiceItem(
            name=data['name'],
            description=data.get('description', ''), 
            category_id=data['category_id'],
            estimated_time_mins=int(data.get('estimated_time_mins', 0)),
            pricing_type=data.get('pricing_type', 'fixed'),
            default_rate=float(data.get('default_rate', 0.0)),
            is_material=bool(data.get('is_material', False)),
            is_variable_price=bool(data.get('is_variable_price', False)),
            is_extra=bool(data.get('is_extra', False)),
            default_checklist=data.get('default_checklist', []),
            tenant_id=current_user.tenant_id
        )
        
        if 'linked_clause_ids' in data:
             clauses = ServiceClause.query.filter(
                ServiceClause.id.in_(data['linked_clause_ids']),
                ServiceClause.tenant_id == current_user.tenant_id
            ).all()
             new_item.linked_clauses = clauses

        db.session.add(new_item)
        db.session.commit()
        
        log_activity('Service Created', f"Admin created service: {new_item.name}")
        return jsonify(new_item.to_dict()), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 500

@bp.route('/admin/service-items/<int:item_id>', methods=['PUT'])
@login_required
def update_service_item(item_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
        
    service_item = ServiceItem.query.filter_by(id=item_id, tenant_id=current_user.tenant_id).first()
    if not service_item:
        return jsonify({"message": "Service item not found"}), 404
        
    data = request.get_json()
    
    try:
        service_item.name = data.get('name', service_item.name)
        service_item.description = data.get('description', service_item.description) # Update description
        service_item.estimated_time_mins = int(data.get('estimated_time_mins', service_item.estimated_time_mins))
        service_item.pricing_type = data.get('pricing_type', service_item.pricing_type)
        service_item.default_rate = float(data.get('default_rate', service_item.default_rate))
        service_item.is_material = bool(data.get('is_material', service_item.is_material))
        service_item.is_variable_price = bool(data.get('is_variable_price', service_item.is_variable_price))
        service_item.is_extra = bool(data.get('is_extra', service_item.is_extra))

        if 'default_checklist' in data:
            service_item.default_checklist = data['default_checklist']
            flag_modified(service_item, "default_checklist")

        if 'category_id' in data and data['category_id'] != service_item.category_id:
            cat = ServiceCategory.query.filter_by(id=data['category_id'], tenant_id=current_user.tenant_id).first()
            if cat:
                service_item.category_id = cat.id

        if 'linked_clause_ids' in data:
            clauses = ServiceClause.query.filter(
                ServiceClause.id.in_(data['linked_clause_ids']),
                ServiceClause.tenant_id == current_user.tenant_id
            ).all()
            service_item.linked_clauses = clauses
        
        db.session.commit()
        return jsonify(service_item.to_dict()), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 500

@bp.route('/admin/service-items/<int:item_id>', methods=['DELETE'])
@login_required
def delete_service_item(item_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
        
    service_item = ServiceItem.query.filter_by(id=item_id, tenant_id=current_user.tenant_id).first()
    if not service_item:
        return jsonify({"message": "Service item not found"}), 404
        
    try:
        db.session.delete(service_item)
        db.session.commit()
        log_activity('Service Deleted', f"Admin deleted service ID: {item_id}")
        return jsonify({"message": "Service deleted successfully"}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": str(e)}), 500
    
@bp.route('/admin/all-services', methods=['GET'])
@login_required
def get_all_services_list():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
    
    try:
        # TENANT AWARE
        services = ServiceItem.query.options(
            joinedload(ServiceItem.prices),
            joinedload(ServiceItem.linked_clauses)
        ).filter_by(
            tenant_id=current_user.tenant_id # <--- SECURITY
        ).order_by(ServiceItem.name).all()
        
        service_list = []
        for item in services:
            default_price = 0.0
            if item.prices:
                once_off = next((p.price for p in item.prices if 'once' in p.frequency.lower()), None)
                default_price = once_off if once_off is not None else item.prices[0].price
            
            linked_clause_ids = [clause.id for clause in item.linked_clauses]
            
            service_list.append({
                'id': item.id,
                'name': item.name,
                'default_description': item.name, 
                'default_price': default_price,
                'linked_clause_ids': linked_clause_ids 
            })
        return jsonify(service_list)
        
    except Exception as e:
        print(f"Error fetching all services: {e}")
        traceback.print_exc()
        return jsonify({"message": "Error fetching service list."}), 500
    
@bp.route('/admin/jobs/<int:job_id>', methods=['DELETE'])
@login_required
def delete_job(job_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    try:
        # TENANT AWARE
        job = Job.query.filter_by(
            id=job_id,
            tenant_id=current_user.tenant_id
        ).first()
        
        if not job:
            return jsonify({"message": "Job not found."}), 404

        if job.quote_request:
             job.quote_request.status = 'Confirmed' 

        client_email = job.client.email if job.client else "Unknown Client"
        job_date = job.scheduled_date

        log_activity(
            'Job Deleted',
            f"Admin '{current_user.email}' deleted job #{job.id} (Client: {client_email}, Date: {job_date})."
        )

        db.session.delete(job)
        db.session.commit()

        return jsonify({"message": f"Job #{job_id} deleted successfully."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error deleting job {job_id}: {e}")
        traceback.print_exc()
        return jsonify({"message": f"An internal server error occurred: {str(e)}"}), 500

@bp.route('/admin/jobs/<int:job_id>', methods=['GET'])
@login_required
def get_job_details(job_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
        
    try:
        # Bulletproof query without fragile joins
        job = Job.query.filter_by(
            id=job_id,
            tenant_id=current_user.tenant_id
        ).first()
        
        if not job:
            return jsonify({"message": "Job not found."}), 404
            
        # Safe Client Name
        client_name = "N/A"
        if job.client:
            profile = getattr(job.client, 'profile', None)
            if not profile and hasattr(job.client, 'profiles') and job.client.profiles:
                profile = job.client.profiles[0]
            client_name = getattr(profile, 'full_name', None) or job.client.email
                    
        # Safe Service Name
        service_name = "Custom/Other"
        if getattr(job, 'quote_request', None) and getattr(job.quote_request, 'primary_service', None):
            service_name = job.quote_request.primary_service
        elif getattr(job, 'service', None) and getattr(job.service, 'name', None):
            service_name = job.service.name
                
        # Safe Staff ID extraction
        assigned_staff_id = ""
        staff_list = getattr(job, 'assigned_staff', None) or getattr(job, 'staff', [])
        if staff_list and len(staff_list) > 0:
            assigned_staff_id = staff_list[0].id
            
        job_data = {
            "id": job.id,
            "client_id": job.client_id,
            "client_name": client_name,
            "service_name": service_name,
            "scheduled_date": job.scheduled_date.isoformat() if job.scheduled_date else None,
            "start_time": job.start_time.strftime('%H:%M') if job.start_time else "09:00",
            "assigned_staff_id": assigned_staff_id,
            "status": job.status or "Scheduled",
            "notes": job.notes or ""
        }
        return jsonify(job_data)
            
    except Exception as e:
        import traceback
        print(f"--- CRASH IN get_job_details for job {job_id} ---")
        traceback.print_exc()
        return jsonify({"message": f"An internal server error occurred: {str(e)}"}), 500

@bp.route('/admin/jobs/<int:job_id>', methods=['PUT'])
@login_required
def update_job_details(job_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
            
    try:
        # Bulletproof query without fragile joins
        job = Job.query.filter_by(
            id=job_id,
            tenant_id=current_user.tenant_id
        ).first()
        
        if not job:
            return jsonify({"message": "Job not found."}), 404
            
        data = request.get_json()
        if not data:
            return jsonify({"message": "No data provided."}), 400
            
        scheduled_date_str = data.get('scheduled_date')
        scheduled_time_str = data.get('start_time')
        staff_id = data.get('staff_id')
        status = data.get('status')
        notes = data.get('notes')
        
        if not all([scheduled_date_str, scheduled_time_str, status]):
             return jsonify({"message": "Missing required fields."}), 400
                     
        job.scheduled_date = datetime.strptime(scheduled_date_str, '%Y-%m-%d').date()
        job.start_time = datetime.strptime(scheduled_time_str, '%H:%M').time()
        
        allowed_statuses = ['Scheduled', 'In Progress', 'Completed', 'Cancelled']
        if status not in allowed_statuses:
            return jsonify({"message": "Invalid status value."}), 400
            
        job.status = status
        job.notes = notes
        
        # Safely update staff
        staff_list = getattr(job, 'assigned_staff', None)
        if staff_list is None: 
            staff_list = getattr(job, 'staff', None)
            
        if staff_id:
            new_staff_user = User.query.filter_by(
                id=staff_id, 
                role='staff',
                tenant_id=current_user.tenant_id
            ).first()
            
            if not new_staff_user:
                return jsonify({"message": "Invalid staff member selected."}), 404
                
            if staff_list is not None:
                staff_list.clear()
                staff_list.append(new_staff_user)
        else:
            if staff_list is not None:
                staff_list.clear()
                
        log_activity(
            'Job Updated', 
            f"Admin '{current_user.email}' updated job #{job.id}."
        )
        
        db.session.commit()
        return jsonify({"message": f"Job #{job.id} updated successfully."}), 200
        
    except ValueError as e:
        db.session.rollback()
        return jsonify({"message": f"Invalid data format: {e}. Use YYYY-MM-DD and HH:MM."}), 400
    except Exception as e:
        db.session.rollback()
        import traceback
        print(f"--- CRASH IN update_job_details for job {job_id} ---")
        traceback.print_exc()
        return jsonify({"message": f"An internal server error occurred: {str(e)}"}), 500

@bp.route('/admin/jobs/update_status/<int:job_id>', methods=['POST'])
@login_required
def update_job_status(job_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    # TENANT AWARE
    job = Job.query.filter_by(
        id=job_id,
        tenant_id=current_user.tenant_id
    ).first()
    
    if not job:
        return jsonify({"message": "Job not found."}), 404
        
    data = request.get_json()
    new_status = data.get('status')
    
    if not new_status:
        return jsonify({"message": "No status provided."}), 400

    allowed_statuses = ['Scheduled', 'In Progress', 'Completed', 'Cancelled']
    if new_status not in allowed_statuses:
        return jsonify({"message": "Invalid status value."}), 400
        
    try:
        job.status = new_status
        
        log_activity(
            'Job Status Updated', 
            f"Admin '{current_user.email}' updated job #{job.id} status to '{new_status}'."
        )
        db.session.commit()
        
        return jsonify({"message": f"Job #{job.id} status updated to '{new_status}'."}), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error quick-updating job status for {job_id}: {e}")
        traceback.print_exc()
        return jsonify({"message": f"An internal server error occurred: {str(e)}"}), 500

@bp.route('/admin/staff/<int:user_id>', methods=['GET'])
@login_required
def get_staff_details(user_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    try:
        # TENANT AWARE
        staff_member = User.query.options(joinedload(User.profile)).filter(
            User.id == user_id, 
            User.role == 'staff',
            User.tenant_id == current_user.tenant_id
        ).first()

        if not staff_member:
            return jsonify({"message": "Staff member not found"}), 404

        age = None
        if staff_member.profile and staff_member.profile.date_of_birth:
            today = date.today()
            dob = staff_member.profile.date_of_birth
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

        profile_data = {}
        if staff_member.profile:
            profile_data = {
                "full_name": staff_member.profile.full_name or 'N/A',
                "phone_number": staff_member.profile.phone_number or 'N/A',
                "address": staff_member.profile.address or 'N/A',
                "profile_image": staff_member.profile.profile_image or 'avatar_picture_profile_user_icon.png',
                "id_number": staff_member.profile.id_number or 'N/A',
                "date_of_birth": staff_member.profile.date_of_birth.strftime('%d %B %Y') if staff_member.profile.date_of_birth else 'N/A',
                "age": age,
                "strengths": staff_member.profile.strengths or '',
                "notes": staff_member.profile.notes or '',
                "documents": staff_member.profile.documents or [], 
                "has_id_copy": staff_member.profile.has_id_copy or False,
                "has_drivers_license": staff_member.profile.has_drivers_license or False,
                "has_criminal_check": staff_member.profile.has_criminal_check or False,
            }
        else: 
             profile_data = {
                "full_name": 'N/A', "phone_number": 'N/A', "address": 'N/A', "profile_image": 'avatar_picture_profile_user_icon.png',
                "id_number": 'N/A', "date_of_birth": 'N/A', "age": None, "strengths": '', "notes": '', "documents": [],
                "has_id_copy": False, "has_drivers_license": False, "has_criminal_check": False
             }

        staff_data = {
            "id": staff_member.id,
            "email": staff_member.email,
            "profile": profile_data,
        }
        return jsonify(staff_data)

    except Exception as e:
        print(f"Error fetching staff details for ID {user_id}: {e}")
        return jsonify({"message": "Error fetching staff data."}), 500
    
@bp.route('/admin/staff/<int:user_id>', methods=['PUT', 'POST'])
@login_required
def update_staff_details(user_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    # TENANT AWARE
    staff_member = User.query.options(joinedload(User.profile)).filter(
        User.id == user_id, 
        User.role == 'staff',
        User.tenant_id == current_user.tenant_id
    ).first()

    if not staff_member or not staff_member.profile:
        return jsonify({"message": "Staff member or profile not found"}), 404

    profile = staff_member.profile
    profile.full_name = request.form.get('full_name', profile.full_name)
    profile.phone_number = request.form.get('phone_number', profile.phone_number)
    profile.address = request.form.get('address', profile.address)
    profile.id_number = request.form.get('id_number', profile.id_number)
    profile.strengths = request.form.get('strengths', profile.strengths)
    profile.notes = request.form.get('notes', profile.notes)

    profile.has_id_copy = request.form.get('has_id_copy') == 'true'
    profile.has_drivers_license = request.form.get('has_drivers_license') == 'true'
    profile.has_criminal_check = request.form.get('has_criminal_check') == 'true'

    try:
        if 'profile_image' in request.files:
            file = request.files['profile_image']
            if file and file.filename != '':
                filename = secure_filename(file.filename)
                unique_filename = str(uuid.uuid4()) + "_" + filename
                upload_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
                file.save(upload_path)
                profile.profile_image = unique_filename

        if 'upload_documents' in request.files:
            uploaded_files = request.files.getlist('upload_documents')
            new_filenames = []
            if profile.documents is None: 
                profile.documents = []

            for file in uploaded_files:
                if file and file.filename != '':
                    filename = secure_filename(file.filename)
                    unique_filename = str(uuid.uuid4()) + "_" + filename
                    file.save(os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename))
                    new_filenames.append(unique_filename)

            if new_filenames:
                profile.documents.extend(new_filenames)
                flag_modified(profile, "documents") 

        db.session.commit()
        log_activity('Staff Updated (API)', f"Admin '{current_user.email}' updated profile for {staff_member.email}")

        updated_data = get_staff_details(user_id).get_json() 

        return jsonify({
            "message": "Staff profile updated successfully.",
            "staffMember": updated_data 
        })

    except Exception as e:
        db.session.rollback()
        print(f"Error updating staff via API (User ID: {user_id}): {e}")
        return jsonify({'message': f'Database error occurred: {e}'}), 500

@bp.route('/admin/staff', methods=['POST'])
@login_required
def api_add_staff():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    data = request.json
    form = AddStaffForm(data=data) 
    
    send_email = data.get('send_activation_email', False) 

    if form.validate():
        # Check if email exists globally
        if User.query.filter_by(email=form.email.data).first():
            return jsonify({'message': 'A user with this email already exists.'}), 400

        try:
            new_staff = User(
                email=form.email.data,
                role='staff',
                is_confirmed=True,
                password_reset_required=True,
                tenant_id=current_user.tenant_id # <--- TENANT AWARE
            )
            
            new_profile = Profile(
                user=new_staff,
                full_name=form.full_name.data,
                phone_number=form.phone_number.data,
                address=form.address.data,
                id_number=form.id_number.data,
                tenant_id=current_user.tenant_id # <--- TENANT AWARE
            )

            db.session.add(new_staff)
            db.session.add(new_profile)
            db.session.commit()

            log_activity('Staff Created (API)', f"Admin '{current_user.email}' created staff: {form.email.data}")

            success_message = f"Staff member '{form.full_name.data}' created."

            if send_email:
                try:
                    token = generate_confirmation_token(new_staff.id) 
                    activation_url = url_for('auth.staff_activate_token', token=token, _external=True)
                    msg = Message(subject="[Nieuwburg Blitz] Activate Your Staff Account",
                                  sender=current_app.config['MAIL_USERNAME'],
                                  recipients=[new_staff.email])
                    msg.body = f"Welcome! An account has been created for you. Please click this link to set your password: {activation_url}"
                    send_async_email(current_app._get_current_object(), msg)
                    success_message += " An activation email has been sent."
                except Exception as e:
                    print(f"Failed to send activation email for {new_staff.email}: {e}")
                    success_message += " Email sending failed."
            else:
                success_message += " No activation email was sent."

            return jsonify({'message': success_message}), 201

        except Exception as e:
            db.session.rollback()
            print(f"Error adding staff via API: {e}")
            return jsonify({'message': 'Database error occurred.'}), 500

    else:
        errors = [f"{field}: {', '.join(error_list)}" for field, error_list in form.errors.items()]
        return jsonify({'message': f"Validation failed: {'; '.join(errors)}"}), 400
    
@bp.route('/admin/staff/all', methods=['GET'])
@login_required
def api_get_all_staff():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
    try:
        # Bulletproof query without fragile joins
        staff_list = User.query.filter_by(
            role='staff',
            tenant_id=current_user.tenant_id
        ).all()

        staff_data = []
        for staff in staff_list:
            full_name = staff.email
            
            # Safely extract profile full_name preventing any attribute crashes
            profile = getattr(staff, 'profile', None)
            if not profile and hasattr(staff, 'profiles') and staff.profiles:
                profile = staff.profiles[0]
                
            if profile and getattr(profile, 'full_name', None):
                full_name = profile.full_name
                
            staff_data.append({
                "id": staff.id,
                "full_name": full_name,
                "email": staff.email
            })
            
        staff_data.sort(key=lambda x: x['full_name'])
        return jsonify(staff_data)
        
    except Exception as e:
        import traceback
        print("--- CRASH IN api_get_all_staff ---")
        traceback.print_exc()
        # Return an empty array on error so React .map() NEVER crashes
        return jsonify([]), 500

@bp.route('/admin/services/all_items', methods=['GET'])
@login_required
def api_get_all_service_items():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
    try:
        # TENANT AWARE
        service_items = ServiceItem.query.filter_by(
            tenant_id=current_user.tenant_id
        ).order_by(ServiceItem.name).all() 
        
        items_data = [{
            "id": item.id,
            "name": item.name
        } for item in service_items]
        
        return jsonify(items_data)
    except Exception as e:
        print(f"Error fetching all service items: {e}")
        return jsonify({"message": "Error fetching service item list."}), 500


@bp.route('/admin/jobs/manual_add', methods=['POST'])
@login_required
def api_add_job_manually():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
    
    data = request.get_json()
    if not data:
        return jsonify({"message": "No data provided."}), 400
        
    client_id = data.get('client_id') 
    save_new_client = data.get('save_new_client', False)
    
    full_name = data.get('full_name')
    email = data.get('email')
    phone_number = data.get('phone_number')
    address = data.get('address') 

    service_item_id = data.get('service_item_id')
    service_price_str = data.get('service_price') 
    service_frequency = data.get('service_frequency')
    staff_id = data.get('staff_id')
    scheduled_date_str = data.get('scheduled_date')
    scheduled_time_str = data.get('scheduled_time')

    client = None
    if client_id:
        # TENANT AWARE
        client = User.query.filter_by(
            id=client_id,
            role='client',
            tenant_id=current_user.tenant_id
        ).first()

        if not client:
            return jsonify({"message": "Selected client not found."}), 404
        booking_address = address or (client.profile.address if client.profile else 'N/A')
    
    elif save_new_client:
        if not full_name or not email:
            return jsonify({"message": "Full Name and Email are required to save a new client."}), 400
        
        existing = User.query.filter_by(email=email).first()
        if existing:
            return jsonify({"message": f"A user with the email {email} already exists."}), 400
        
        try:
            temp_password = secrets.token_urlsafe(12)
            new_client = User(
                email=email, 
                role='client', 
                is_confirmed=True,
                tenant_id=current_user.tenant_id # <--- TENANT AWARE
            )
            new_client.set_password(temp_password)
            
            new_profile = Profile(
                user=new_client,
                full_name=full_name,
                phone_number=phone_number,
                address=address,
                tenant_id=current_user.tenant_id # <--- TENANT AWARE
            )
            db.session.add(new_client)
            db.session.add(new_profile)
            db.session.commit() 
            client = new_client
            booking_address = address 
            log_activity('Client Created (Manual Booking)', f"Admin '{current_user.email}' created client: {email}")
        
        except Exception as e:
            db.session.rollback()
            print(f"Error creating new client during manual booking: {e}")
            traceback.print_exc()
            return jsonify({"message": "Database error creating new client."}), 500
            
    else: 
         return jsonify({"message": "Please select an existing client or check 'Save as new client'."}), 400

    if not all([service_item_id, service_price_str, service_frequency, staff_id, scheduled_date_str, scheduled_time_str]):
         return jsonify({"message": "Missing required job details (Service, Price, Frequency, Staff, Date, Time)."}), 400
         
    try:
        # TENANT AWARE Staff Check
        staff_user = User.query.filter_by(
            id=staff_id,
            role='staff',
            tenant_id=current_user.tenant_id
        ).first()
        
        if not staff_user:
            return jsonify({"message": "Invalid staff member selected."}), 404
            
        # TENANT AWARE Service Check
        service_item = ServiceItem.query.filter_by(
            id=service_item_id,
            tenant_id=current_user.tenant_id
        ).first()

        if not service_item:
            return jsonify({"message": "Invalid service selected."}), 404
            
        parsed_date = datetime.strptime(scheduled_date_str, '%Y-%m-%d').date()
        parsed_time = datetime.strptime(scheduled_time_str, '%H:%M').time()
        parsed_price = float(service_price_str) 
        
    except ValueError as e:
        return jsonify({"message": f"Invalid data format: {e}. Ensure date is YYYY-MM-DD, time is HH:MM, and price is a number."}), 400
    except Exception as e: 
        return jsonify({"message": f"Error validating job data: {e}"}), 400

    try:
        new_quote = QuoteRequest(
            user_id=client.id,
            primary_service=service_item.name,
            property_type="N/A (Manual)", 
            service_frequency=service_frequency,
            address=booking_address, 
            total_price=parsed_price,
            status='Scheduled',
            tenant_id=current_user.tenant_id # <--- TENANT AWARE
        )
        db.session.add(new_quote)
        db.session.flush() 
        
        new_job = Job(
            quote_request_id=new_quote.id, 
            client_id=client.id,
            service_id=service_item.id,
            scheduled_date=parsed_date,
            start_time=parsed_time,
            status='Scheduled',
            notes=f"Job manually created by admin {current_user.email}.",
            tenant_id=current_user.tenant_id # <--- TENANT AWARE
        )
        new_job.assigned_staff.append(staff_user) 
        db.session.add(new_job)
        
        log_activity(
            'Manual Job Created', 
            f"Admin '{current_user.email}' created job #{new_job.id} for {client.email}. Assigned to {staff_user.profile.full_name}."
        )
        
        db.session.commit()
        
        return jsonify({
            "message": "Manual job created successfully!",
            "job_id": new_job.id
        }), 201 

    except Exception as e:
        db.session.rollback() 
        print(f"Error saving manual job: {e}")
        traceback.print_exc()
        return jsonify({"message": f"An internal server error occurred while saving the job: {str(e)}"}), 500

@bp.route('/posts')
def posts():
    # PUBLIC ROUTE: Needs to handle tenancy via domain or fallback to "main" tenant
    # For now, fetching ALL published posts from ALL tenants (Marketplace style?)
    # Or strict to one tenant if subdomain logic exists. 
    # DEFAULT: Fetch all.
    posts = Post.query.filter_by(is_published=True).order_by(Post.created_date.desc()).limit(3).all()
    posts_data = [{
        "id": post.id,
        "title": post.title,
        "excerpt": post.excerpt or (post.content[:150] + '...'),
        "date": post.created_date.strftime('%d %B %Y')
    } for post in posts]
    return jsonify(posts_data)

@bp.route('/recent-activity')
@login_required
def recent_activity():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"error": "Permission denied"}), 403

    # TENANT AWARE
    logs = ActivityLog.query.filter_by(
        tenant_id=current_user.tenant_id
    ).order_by(ActivityLog.timestamp.desc()).limit(5).all()
    
    sast_timezone = pytz.timezone('Africa/Johannesburg')

    recent_logs = [{
        'timestamp': pytz.utc.localize(log.timestamp).astimezone(sast_timezone).strftime('%d %b, %H:%M'),
        'description': log.description,
        'user_email': log.user.email if log.user else 'System'
    } for log in logs]
    
    return jsonify(recent_logs)

@bp.route('/admin/jobs/current', methods=['GET'])
@login_required
def get_current_jobs():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    try:
        # TENANT AWARE
        current_jobs = Job.query.options(
            joinedload(Job.quote_request).joinedload(QuoteRequest.user).joinedload(User.profile),
            joinedload(Job.assigned_staff).joinedload(User.profile) 
        ).filter(
            Job.status.in_(['Scheduled', 'In-Progress']),
            Job.tenant_id == current_user.tenant_id # <--- TENANT AWARE
        ).order_by(Job.scheduled_date.asc(), Job.start_time.asc()).all()

        jobs_data = []
        for job in current_jobs:
            client_name = "N/A",
            primary_service = "N/A"
            if job.quote_request and job.quote_request.user:
                client_name = job.quote_request.user.profile.full_name or job.quote_request.user.email if job.quote_request.user.profile else job.quote_request.user.email
                primary_service = job.quote_request.primary_service or "N/A"

            assigned_staff_names = [
                staff.profile.full_name or staff.email
                for staff in job.assigned_staff if staff.profile
            ] or ["None"] 

            jobs_data.append({
                "id": job.id,
                "scheduled_date": job.scheduled_date.strftime('%d %b %Y') if job.scheduled_date else 'N/A',
                "scheduled_date_iso": job.scheduled_date.isoformat() if job.scheduled_date else None,
                "start_time": job.start_time.strftime('%H:%M') if job.start_time else '--:--',
                "client_name": client_name,
                "service": primary_service,
                "status": job.status,
                "assigned_staff": ", ".join(assigned_staff_names)
            })
        return jsonify(jobs_data)

    except Exception as e:
        print(f"Error fetching current jobs: {e}")
        return jsonify({"message": "Error fetching current job data."}), 500

@bp.route('/admin/bookings/new', methods=['GET'])
@login_required
def get_new_bookings():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    try:
        # TENANT AWARE
        new_bookings = QuoteRequest.query.options(
            joinedload(QuoteRequest.user).joinedload(User.profile)
        ).filter(
            QuoteRequest.status == 'Confirmed',
            QuoteRequest.tenant_id == current_user.tenant_id # <--- TENANT AWARE
        ).order_by(QuoteRequest.request_date.desc()).all()

        bookings_data = []
        for req in new_bookings:
            client_name = "N/A"
            client_phone = "No phone"
            if req.user:
                 client_name = req.user.profile.full_name or req.user.email if req.user.profile else req.user.email
                 client_phone = req.user.profile.phone_number or "No phone" if req.user.profile else "No phone"


            bookings_data.append({
                "id": req.id,
                "request_date": req.request_date.strftime('%d %b %Y, %H:%M') if req.request_date else 'N/A',
                "client_name": client_name,
                "client_phone": client_phone,
                "service": req.primary_service or "N/A",
                "property_type": req.property_type or "N/A",
                "address": req.address or "N/A", 
                "total_price": req.total_price if req.total_price is not None else 'N/A',
                "user_id": req.user_id 
            })
        return jsonify(bookings_data)
    except Exception as e:
        print(f"Error fetching new bookings: {e}")
        return jsonify({"message": "Error fetching new booking data."}), 500
    
@bp.route('/admin/jobs/schedule', methods=['POST'])
@login_required
def schedule_new_job_from_quote():
    if current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    data = request.get_json()
    quote_request_id = data.get('quote_request_id')
    staff_id = data.get('staff_id')
    scheduled_date_str = data.get('scheduled_date') 
    scheduled_time_str = data.get('scheduled_time') 

    if not all([quote_request_id, staff_id, scheduled_date_str, scheduled_time_str]):
        return jsonify({"message": "Missing required fields (Booking ID, Staff, Date, Time)."}), 400

    try:
        # TENANT AWARE
        quote = QuoteRequest.query.filter_by(
            id=quote_request_id,
            tenant_id=current_user.tenant_id
        ).first()
        
        if not quote:
            return jsonify({"message": "Booking Request not found."}), 404
        if quote.status != 'Confirmed':
            return jsonify({"message": "This booking is not confirmed or has already been scheduled."}), 400

        staff_user = User.query.filter_by(
            id=staff_id,
            role='staff',
            tenant_id=current_user.tenant_id
        ).first()
        
        if not staff_user:
            return jsonify({"message": "Invalid staff member selected."}), 404
            
        client = db.session.get(User, quote.user_id)
        if not client or client.role != 'client':
            return jsonify({"message": "Associated client account not found."}), 404

        # TENANT AWARE Service Lookup
        service_item = ServiceItem.query.filter_by(
            name=quote.primary_service,
            tenant_id=current_user.tenant_id
        ).first()
        
        if not service_item:
            return jsonify({"message": f"Service '{quote.primary_service}' not found in Service list."}), 404

        try:
            parsed_date = datetime.strptime(scheduled_date_str, '%Y-%m-%d').date()
            parsed_time = datetime.strptime(scheduled_time_str, '%H:%M').time()
        except ValueError:
            return jsonify({"message": "Invalid date or time format. Use YYYY-MM-DD and HH:MM."}), 400

        new_job = Job(
            quote_request_id=quote.id,
            client_id=client.id,
            service_id=service_item.id, 
            scheduled_date=parsed_date,  
            start_time=parsed_time,      
            status='Scheduled',
            notes=f"Job scheduled from QuoteRequest #{quote.id}. Address: {quote.address or 'N/A'}",
            tenant_id=current_user.tenant_id # <--- TENANT AWARE
        )
        
        new_job.assigned_staff.append(staff_user)
        quote.status = 'Scheduled' 
        
        log_entry = ActivityLog(
            user_id=current_user.id,
            action=f"Scheduled job for booking #{quote.id}. Assigned to {staff_user.profile.full_name}.",
            tenant_id=current_user.tenant_id
        )

        db.session.add(new_job)
        db.session.add(log_entry)
        db.session.commit()

        return jsonify({
            "message": "Job scheduled successfully!",
            "job_id": new_job.id
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"Error scheduling job from quote: {e}")
        traceback.print_exc() 
        return jsonify({"message": f"An internal error occurred: {str(e)}"}), 500
    
@bp.route('/admin/bookings/new/<int:quote_id>', methods=['GET'])
@login_required
def get_new_booking_detail(quote_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    try:
        # TENANT AWARE
        req = QuoteRequest.query.filter_by(
            id=quote_id,
            tenant_id=current_user.tenant_id
        ).first()
        
        if not req:
            return jsonify({"message": "Booking request not found."}), 404
        
        if req.status != 'Confirmed':
             return jsonify({"message": "This booking is not in a 'Confirmed' state."}), 400

        client_name = "N/A"
        client_phone = "No phone"
        if req.user:
            if req.user.profile:
                client_name = req.user.profile.full_name or req.user.email
                client_phone = req.user.profile.phone_number or "No phone"
            else:
                client_name = req.user.email

        booking_data = {
            "id": req.id,
            "request_date": req.request_date.strftime('%d %b %Y, %H:%M') if req.request_date else 'N/A',
            "client_name": client_name,
            "client_phone": client_phone,
            "service": req.primary_service or "N/A",
            "property_type": req.property_type or "N/A",
            "address": req.address or "N/A",
            "total_price": req.total_price if req.total_price is not None else 'N/A',
            "user_id": req.user_id
        }
        return jsonify(booking_data)
    except Exception as e:
        print(f"Error fetching new booking detail: {e}")
        return jsonify({"message": "Error fetching new booking data."}), 500
    
@bp.route('/admin/jobs/scheduled', methods=['GET'])
@login_required
def get_scheduled_jobs():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
    try:
        # Standard query - no special imports required
        jobs = Job.query.filter_by(tenant_id=current_user.tenant_id).order_by(Job.scheduled_date.desc()).all()
        
        jobs_data = []
        for job in jobs:
            # 1. Safe Client Name extraction
            client_name = "N/A"
            if job.client:
                # getattr prevents crashes if profile doesn't exist
                client_name = getattr(job.client.profile, 'full_name', None) or job.client.email
                
            # 2. Safe Service Name
            service_name = job.service.name if job.service else "Custom/Other"
            
            # 3. Safe Staff Name (checks multiple possible relationship names to avoid crashes)
            staff_names = "Unassigned"
            staff_list = getattr(job, 'assigned_staff', None) or getattr(job, 'staff', [])
            if staff_list:
                names = [getattr(s.profile, 'full_name', None) or s.email for s in staff_list if s]
                staff_names = ", ".join(filter(None, names)) or "Unassigned"
            
            # 4. Safe Date & Time formatting (handles both datetime objects and raw strings)
            sched_date = str(job.scheduled_date) if job.scheduled_date else None
            start_time = str(job.start_time)[:5] if job.start_time else "09:00"
            
            jobs_data.append({
                "id": job.id,
                "client_name": client_name,
                "service_name": service_name,
                "scheduled_date": sched_date,
                "start_time": start_time,
                "assigned_staff": staff_names,
                "status": job.status or 'Scheduled'
            })
            
        return jsonify(jobs_data)
        
    except Exception as e:
        import traceback
        print("--- CRASH IN get_scheduled_jobs ---")
        traceback.print_exc() # This prints the exact error to your terminal!
        return jsonify({"error": str(e)}), 500

@bp.route('/admin/quotes', methods=['GET'])
@login_required
def get_all_quotes():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
    try:
        combined_list = []
        sast = pytz.timezone('Africa/Johannesburg') 

        # --- 1. FETCH QUOTE REQUESTS (Pending/Incoming) ---
        # FIX: Only grab ones that are still Pending, ensuring they vanish when Confirmed.
        quote_requests = QuoteRequest.query.filter(
            QuoteRequest.status.in_(['Pending', 'New']),
            QuoteRequest.tenant_id == current_user.tenant_id
        ).all()
        
        for req in quote_requests:
            formatted_date = 'N/A'
            if req.request_date:
                utc_dt = pytz.utc.localize(req.request_date) 
                sast_dt = utc_dt.astimezone(sast) 
                formatted_date = sast_dt.strftime('%d %b %Y, %H:%M') 

            client_name = req.name
            if not client_name and req.user:
                client_name = req.user.profile.full_name if req.user.profile else req.user.email

            client_phone = req.phone
            if not client_phone and req.user and req.user.profile:
                client_phone = req.user.profile.phone_number

            combined_list.append({
                "id": req.id,
                "type": "request", 
                "list_id": f"request_{req.id}", 
                "request_date": formatted_date, 
                "client_name": client_name or "N/A",
                "client_phone": client_phone or "N/A",
                "service": req.primary_service or "N/A", 
                "property_type": req.property_type if req.property_type and req.property_type != "N/A" else "", 
                "frequency": req.service_frequency or "N/A",
                "total_price": req.total_price or 0.0,
                "status": req.status or "Unknown",
                "view_url": f"/quotes/{req.id}", 
                "user_id": req.user_id
            })

        # --- 2. FETCH FORMAL QUOTES (Draft/Sent/Accepted) ---
        formal_quotes = Quote.query.filter_by(
            tenant_id=current_user.tenant_id
        ).all()

        for quote in formal_quotes:
            formatted_date = 'N/A'
            if quote.quote_date:
                formatted_date = quote.quote_date.strftime('%d %b %Y')

            client_name = quote.guest_name
            if not client_name and quote.user:
                client_name = quote.user.profile.full_name if quote.user.profile else quote.user.email
            
            client_phone = quote.guest_phone
            if not client_phone and quote.user and quote.user.profile:
                client_phone = quote.user.profile.phone_number

            combined_list.append({
                "id": quote.id,
                "type": "quote", 
                "list_id": f"quote_{quote.id}", 
                "request_date": formatted_date, 
                "client_name": client_name or "N/A",
                "client_phone": client_phone or "N/A",
                "service": f"Formal Quote ({quote.quote_number})", 
                "property_type": "", 
                "frequency": "N/A",
                "total_price": quote.total or 0.0,
                "status": quote.status or "Unknown",
                "view_url": f"/quotes/formal/{quote.id}", 
                "user_id": quote.user_id
            })
            
        def sort_key(item):
            try:
                return datetime.strptime(item['request_date'], '%d %b %Y, %H:%M')
            except ValueError:
                try:
                    return datetime.strptime(item['request_date'], '%d %b %Y')
                except ValueError:
                    return datetime.min

        combined_list.sort(key=sort_key, reverse=True)
        
        return jsonify(combined_list)
        
    except Exception as e:
        print(f"Error fetching all quotes: {e}") 
        import traceback
        traceback.print_exc() 
        return jsonify({"message": "Error fetching quote data."}), 500
    
@bp.route('/admin/invoices', methods=['GET'])
@login_required
def get_all_invoices():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    try:
        # 1. SIMPLIFIED QUERY: Fetch invoices for this tenant without forcing complex joins
        invoices = Invoice.query.filter_by(
            tenant_id=current_user.tenant_id
        ).order_by(Invoice.invoice_date.desc()).all()

        invoices_data = []
        for inv in invoices:
            # 2. Safe Client Name Lookup
            # We try to get the name from the relationship, but fallback safely if missing
            client_name = "Unknown Client"
            
            try:
                if inv.user:
                    # Try to get profile name, fallback to email
                    if inv.user.profile and inv.user.profile.full_name:
                        client_name = inv.user.profile.full_name
                    else:
                        client_name = inv.user.email
            except Exception:
                client_name = "Client Data Error"

            invoices_data.append({
                "id": inv.id,
                "invoice_number": inv.invoice_number or f"INV-{inv.id}", 
                "client_name": client_name,
                "client_id": inv.user_id,
                "issue_date": inv.invoice_date.strftime('%d %b %Y') if inv.invoice_date else 'N/A',
                "due_date": inv.due_date.strftime('%d %b %Y') if inv.due_date else 'N/A',
                "total_amount": inv.total if inv.total is not None else 0.0, 
                "status": inv.status or "Unknown",
                "payment_token": inv.payment_token
            })
            
        return jsonify(invoices_data)

    except Exception as e:
        print(f"Error fetching all invoices: {e}") 
        traceback.print_exc() 
        return jsonify({"message": "Error fetching invoice data."}), 500

@bp.route('/admin/invoices/<int:invoice_id>/send', methods=['POST'])
@login_required
def api_send_invoice(invoice_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    # 1. Fetch Invoice (Tenant Aware)
    invoice = Invoice.query.options(
        joinedload(Invoice.user).joinedload(User.profile),
        joinedload(Invoice.line_items)
    ).filter_by(
        id=invoice_id,
        tenant_id=current_user.tenant_id
    ).first()

    if not invoice:
        return jsonify({"message": "Invoice not found"}), 404

    recipient_email = invoice.user.email
    if not recipient_email:
        return jsonify({"message": "Client has no email address."}), 400

    try:
        # 2. Generate PDF
        logo_path = os.path.join(current_app.root_path, 'static', 'img', 'LogoBlackWithTitle.png')
        
        # Ensure you have 'templates/public/invoice_pdf_template.html'
        pdf_data = render_template_to_pdf(
            'public/invoice_pdf_template.html', 
            invoice=invoice,
            logo_url=logo_path
        )

        if not pdf_data:
            return jsonify({"message": "Failed to generate PDF attachment."}), 500

        # 3. Prepare Email Data
        payment_url = url_for('main.public_invoice_pay', token=invoice.payment_token, _external=True)
        # In production, logo_url should be a hosted URL, but for local dev we might just omit it or use CID
        # For simplicity, we pass None to the template if we can't link a public image yet
        
        email_html = render_template(
            'email/send_invoice.html',
            invoice=invoice,
            payment_url=payment_url,
            business_name="Nieuwburg Blitz", # Or fetch from BusinessSettings
            logo_url=None 
        )

        # 4. Send Email
        filename = f"Invoice_{invoice.invoice_number}.pdf"
        send_email_with_attachment(
            subject=f"Invoice {invoice.invoice_number} from Nieuwburg Blitz",
            recipients=[recipient_email],
            html_body=email_html,
            attachment_data=pdf_data,
            attachment_filename=filename,
            attachment_mimetype='application/pdf'
        )

        log_activity('Invoice Sent', f"Admin sent Invoice {invoice.invoice_number} to {recipient_email}")

        return jsonify({"message": f"Invoice sent successfully to {recipient_email}"}), 200

    except Exception as e:
        print(f"Error sending invoice: {e}")
        traceback.print_exc()
        return jsonify({"message": f"Error sending email: {str(e)}"}), 500

@bp.route('/admin/clients/<int:user_id>', methods=['GET'])
@login_required
def get_client_details(user_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
    try:
        # FIX: Find specific profile for this tenant
        profile = Profile.query.filter_by(user_id=user_id, tenant_id=current_user.tenant_id).first()
        if not profile:
            return jsonify({"message": "Client not found in your list"}), 404
        
        client = profile.user
        profile_data = {
            "full_name": profile.full_name or 'N/A',
            "phone_number": profile.phone_number or 'N/A',
            "address": profile.address or 'N/A',
            "service_frequency": profile.service_frequency or 'N/A',
            "service_fee": profile.service_fee, 
            "notes": profile.notes or '',
            "next_suggested_rotational_task": profile.next_suggested_rotational_task
        }
        bookings = QuoteRequest.query.filter_by(user_id=client.id, tenant_id=current_user.tenant_id).order_by(QuoteRequest.request_date.desc()).limit(10).all()
        booking_history = [{
            "id": b.id,
            "request_date": b.request_date.strftime('%d %b %Y') if b.request_date else 'N/A',
            "primary_service": b.primary_service or 'N/A',
            "status": b.status or 'Unknown',
            "property_type": b.property_type or 'N/A',
            "service_frequency": b.service_frequency or 'N/A' 
        } for b in bookings]

        client_data = {"id": client.id, "email": client.email, "profile": profile_data, "booking_history": booking_history}
        return jsonify(client_data)
    except Exception as e:
        return jsonify({"message": "Error fetching client data."}), 500
    
@bp.route('/admin/clients/search')
@login_required
def search_clients():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"error": "Permission denied"}), 403

    query = request.args.get('q', '').strip().lower()
    
    # FIX: Query 'Profile' directly to ensure we ONLY get data for THIS tenant
    # We join 'User' just to search by email if needed
    profiles_query = Profile.query.join(User).filter(
        User.role == 'client',
        Profile.tenant_id == current_user.tenant_id # STRICT TENANT FILTER
    )

    if query:
        search_term = f"%{query}%"
        profiles_query = profiles_query.filter(
            or_(
                User.email.ilike(search_term),
                Profile.full_name.ilike(search_term)
            )
        )

    profiles = profiles_query.order_by(Profile.full_name, User.email).all()
    
    # Construct data strictly from the PROFILE object (Tenant's copy)
    clients_data = []
    for profile in profiles:
        clients_data.append({
            "id": profile.user_id, # Link to the User ID for clicking
            "full_name": profile.full_name or 'N/A',
            "email": profile.user.email,
            "phone_number": profile.phone_number or 'N/A',
            "address": profile.address or 'N/A',
        })
        
    return jsonify(clients_data)

@bp.route('/admin/staff/search')
@login_required
def search_staff():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"error": "Permission denied"}), 403
    
    try:
        query = request.args.get('q', '').strip().lower()
        
        # Bulletproof query without fragile SQL joins
        staff_list = User.query.filter_by(
            role='staff',
            tenant_id=current_user.tenant_id
        ).all()

        staff_data = []
        for staff in staff_list:
            # Safely extract profile preventing attribute crashes
            profile = getattr(staff, 'profile', None)
            if not profile and hasattr(staff, 'profiles') and staff.profiles:
                profile = staff.profiles[0]
                
            full_name = getattr(profile, 'full_name', None) or 'N/A'
            email = staff.email or ''
            
            # Apply the search filter safely in Python
            if query:
                searchable_text = f"{full_name} {email}".lower()
                if query not in searchable_text:
                    continue
            
            # Safely calculate age
            age = None
            dob = getattr(profile, 'date_of_birth', None)
            if dob:
                today = date.today()
                age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))

            staff_data.append({
                "id": staff.id,
                "full_name": full_name,
                "email": email,
                "phone_number": getattr(profile, 'phone_number', None) or 'N/A',
                "profile_image": getattr(profile, 'profile_image', None),
                "age": age,
            })
            
        staff_data.sort(key=lambda x: x['full_name'])
        return jsonify(staff_data)
        
    except Exception as e:
        import traceback
        print("--- CRASH IN search_staff ---")
        traceback.print_exc()
        # Return an empty array on error so React never crashes
        return jsonify([]), 500

@bp.route('/admin/applications', methods=['GET'])
@login_required
def get_staff_applications():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    try:
        # NOTE: Applications are currently global (public form).
        # In future, you might want these to be tenant-specific if the form is on a tenant's subdomain.
        applications = StaffApplication.query.order_by(StaffApplication.submission_date.desc()).all()
        apps_data = []
        for app in applications:
            apps_data.append({
                "id": app.id,
                "submission_date": app.submission_date.strftime('%d %b %Y, %H:%M') if app.submission_date else 'N/A', 
                "full_name": app.full_name,
                "id_number": app.id_number or 'N/A',
                "email": app.email,
                "phone_number": app.phone_number,
                "document_filenames": app.document_filenames or [] 
            })
        return jsonify(apps_data)
    except Exception as e:
        print(f"Error fetching staff applications: {e}")
        return jsonify({"message": "Error fetching application data."}), 500
    
@bp.route('/admin/blog/posts', methods=['GET']) 
@login_required
def get_admin_blog_posts():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    try:
        # TENANT AWARE
        posts = Post.query.options(
            joinedload(Post.author).joinedload(User.profile)
        ).filter_by(
            tenant_id=current_user.tenant_id
        ).order_by(Post.created_date.desc()).all()

        posts_data = []
        for post in posts:
            posts_data.append({
                "id": post.id,
                "title": post.title,
                "author_name": post.author.profile.full_name if post.author and post.author.profile else post.author.email if post.author else 'System',
                "date_posted": post.created_date.isoformat() if post.created_date else None, 
                "is_published": post.is_published
            })
        return jsonify(posts_data)
    except Exception as e:
        print(f"Error fetching admin blog posts: {e}")
        return jsonify({"message": "Error fetching blog post data."}), 500
    
@bp.route('/admin/service-clauses', methods=['GET'])
@login_required
def get_service_clauses():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
    
    # TENANT AWARE
    clauses = ServiceClause.query.filter_by(
        tenant_id=current_user.tenant_id
    ).order_by(ServiceClause.name).all()
    return jsonify([c.to_dict() for c in clauses])

@bp.route('/admin/service-clauses', methods=['POST'])
@login_required
def create_service_clause():
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
        
    data = request.get_json()
    if not data or not data.get('name') or not data.get('text'):
        return jsonify({"message": "Name and Text are required"}), 400
        
    try:
        new_clause = ServiceClause(
            name=data['name'],
            text=data['text'],
            tenant_id=current_user.tenant_id # <--- TENANT AWARE
        )
        db.session.add(new_clause)
        db.session.commit()
        log_activity('T&C Clause Created', f"Admin '{current_user.email}' created clause: {new_clause.name}")
        return jsonify(new_clause.to_dict()), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"An error occurred: {str(e)}"}), 500

@bp.route('/admin/service-clauses/<int:clause_id>', methods=['PUT'])
@login_required
def update_service_clause(clause_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
        
    # TENANT AWARE
    clause = ServiceClause.query.filter_by(
        id=clause_id,
        tenant_id=current_user.tenant_id
    ).first()

    if not clause:
        return jsonify({"message": "Clause not found"}), 404
        
    data = request.get_json()
    if not data or not data.get('name') or not data.get('text'):
        return jsonify({"message": "Name and Text are required"}), 400
        
    try:
        clause.name = data['name']
        clause.text = data['text']
        db.session.commit()
        log_activity('T&C Clause Updated', f"Admin '{current_user.email}' updated clause: {clause.name}")
        return jsonify(clause.to_dict()), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"An error occurred: {str(e)}"}), 500

@bp.route('/admin/service-clauses/<int:clause_id>', methods=['DELETE'])
@login_required
def delete_service_clause(clause_id):
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403
        
    # TENANT AWARE
    clause = ServiceClause.query.filter_by(
        id=clause_id,
        tenant_id=current_user.tenant_id
    ).first()

    if not clause:
        return jsonify({"message": "Clause not found"}), 404
        
    try:
        db.session.delete(clause)
        db.session.commit()
        log_activity('T&C Clause Deleted', f"Admin '{current_user.email}' deleted clause ID: {clause_id}")
        return jsonify({"message": "Clause deleted successfully"}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": f"An error occurred: {str(e)}"}), 500

# Plan prices in CENTS (R499.00 = 49900)
PLAN_PRICES = {
    'basic': 49900,
    'intermediate': 89900,
    'pro': 129900
}

@bp.route('/subscription/initiate', methods=['POST'])
def initiate_subscription():
    data = request.json
    
    email = data.get('email')
    full_name = data.get('full_name')
    business_name = data.get('business_name')
    industry = data.get('industry')
    plan_type = data.get('plan_type')
    password = data.get('password')

    # 1. VALIDATION
    if not all([email, full_name, business_name, plan_type, password]):
        return jsonify({'message': 'Missing required fields'}), 400

    if plan_type not in PLAN_PRICES:
        return jsonify({'message': 'Invalid plan type'}), 400

    amount_in_cents = PLAN_PRICES[plan_type]
    paystack_ref = str(uuid.uuid4())

    try:
        # 2. CHECK FOR EXISTING USER (Strict Separation)
        existing_user = User.query.filter_by(email=email).first()
    
        if existing_user:
        # BLOCK the upgrade with specific messaging
            return jsonify({
            'message': 'This email is already in use for a Personal account. Please use a different email address or your business email to register your company.'
        }), 409

        # If we get here, it is a NEW user. Proceed to create.
        user = User(
            email=email,
            role='admin', # Set directly to admin
            is_confirmed=False, 
        )
        user.set_password(password)
        db.session.add(user)
        db.session.flush()

        # Create Profile for new user
        new_profile = Profile(
            user_id=user.id,
            full_name=full_name
        )
        db.session.add(new_profile)

        # 3. CREATE THE TENANT (Business)
        new_tenant = Tenant(
            business_name=business_name,
            subscription_plan=plan_type,
            paystack_reference=paystack_ref,
            is_active=False # Inactive until payment
        )
        db.session.add(new_tenant)
        db.session.flush() # Flush to get ID

        # 4. LINK USER TO TENANT & UPGRADE ROLE
        user.tenant_id = new_tenant.id
        user.role = 'admin' 
        
        # Update/Create Settings
        new_settings = BusinessSettings(
            tenant_id=new_tenant.id,
            business_name=business_name
        )
        db.session.add(new_settings)

        # 5. CALL PAYSTACK
        paystack_url = "https://api.paystack.co/transaction/initialize"
        paystack_secret = os.environ.get('PAYSTACK_SECRET_KEY')

        if not paystack_secret:
            raise Exception("PAYSTACK_SECRET_KEY is not set.")

        headers = {
            "Authorization": f"Bearer {paystack_secret}",
            "Content-Type": "application/json"
        }
        
        callback_url = url_for('main.payment_callback', _external=True)

        payload = {
            "email": email,
            "amount": amount_in_cents,
            "reference": paystack_ref,
            "callback_url": callback_url,
            "metadata": {
                "full_name": full_name,
                "business_name": business_name,
                "industry": industry,
                "plan_type": plan_type,
                "user_id": user.id, 
                "tenant_id": new_tenant.id 
            }
        }

        response = requests.post(paystack_url, headers=headers, json=payload)
        response.raise_for_status() 
        
        response_data = response.json()

        if response_data.get('status'):
            db.session.commit()
            
            return jsonify({
                'message': 'Payment initiated successfully',
                'authorization_url': response_data['data']['authorization_url']
            }), 200
        else:
            raise Exception(f"Paystack error: {response_data.get('message')}")

    except requests.exceptions.RequestException as e:
        db.session.rollback() 
        print(f"Paystack API Error: {e}")
        traceback.print_exc()
        return jsonify({'message': f'Error contacting payment provider: {e}'}), 500
    except Exception as e:
        db.session.rollback() 
        print(f"Error in /subscription/initiate: {e}")
        traceback.print_exc()
        return jsonify({'message': f'An internal server error occurred: {str(e)}'}), 500
    
@bp.route('/admin/setup-wizard/save', methods=['POST'])
@login_required
@admin_required
def save_setup_wizard():
    """
    Saves the data from the new tenant setup wizard.
    """
    data = request.json
    if not data:
        return jsonify({"message": "No data provided"}), 400

    tenant_id = current_user.tenant_id
    if not tenant_id:
        return jsonify({"message": "Invalid user: No tenant associated."}), 403

    try:
        # TENANT AWARE
        settings = BusinessSettings.query.filter_by(tenant_id=tenant_id).first()
        
        if not settings:
            settings = BusinessSettings(tenant_id=tenant_id)
            db.session.add(settings)

        settings.business_name = data.get('business_name', settings.business_name)
        settings.business_address = data.get('business_address', settings.business_address)
        settings.registration_number = data.get('registration_number', settings.registration_number)
        settings.default_terms = data.get('default_terms', settings.default_terms)

        db.session.commit()

        return jsonify({
            "message": "Setup complete! Redirecting to your dashboard...",
            "redirect_url": url_for('admin.admin_spa_shell', path='dashboard') 
        }), 200

    except Exception as e:
        db.session.rollback()
        print(f"Error saving setup wizard data for tenant {tenant_id}: {e}")
        traceback.print_exc()
        return jsonify({"message": f"An internal error occurred: {str(e)}"}), 500
    
@bp.route('/services', methods=['GET'])
def get_public_services():
    """
    Public endpoint to fetch service categories and items for the Booking Modal.
    Uses the 'current_user' tenant if logged in, or defaults to the main tenant.
    """
    try:
        # 1. Determine Tenant context
        tenant_id = None
        if current_user.is_authenticated and current_user.tenant_id:
            tenant_id = current_user.tenant_id
        else:
            # Fallback: Fetch the first active tenant (The HQ)
            # In a real multi-tenant app, you might determine this via subdomain
            main_tenant = Tenant.query.filter_by(is_active=True).first()
            if main_tenant:
                tenant_id = main_tenant.id

        if not tenant_id:
            return jsonify([]) # No services available

        # 2. Fetch Categories with Items
        categories = ServiceCategory.query.options(
            joinedload(ServiceCategory.items)
        ).filter_by(
            tenant_id=tenant_id
        ).order_by(ServiceCategory.name).all()
        
        # 3. Format Data for site.js
        categories_data = []
        for category in categories:
            items_data = []
            for item in category.items:
                items_data.append({
                    'id': item.id,
                    'name': item.name,
                    'description': item.description,
                    'estimated_time_mins': item.estimated_time_mins,
                    'pricing_type': item.pricing_type,
                    'default_rate': item.default_rate,
                    'is_material': item.is_material,
                    'is_variable_price': item.is_variable_price,
                    'is_extra': item.is_extra,
                    'prices': [{'frequency': p.frequency, 'price': p.price} for p in item.prices] 
                })
            
            categories_data.append({
                'id': category.id,
                'name': category.name,
                'description': category.description,
                'items': items_data,
                'calculation_method': category.calculation_method
            })
            
        return jsonify(categories_data)

    except Exception as e:
        print(f"Error fetching public services: {e}")
        return jsonify({"message": "Error fetching service data."}), 500
    
@bp.route('/invoice/initiate-payment', methods=['POST'])
def initiate_invoice_payment():
    """
    Called by the frontend to start a Paystack transaction for an INVOICE.
    Now in API blueprint to bypass default CSRF (since API is exempted).
    """
    data = request.json
    token = data.get('token')
    email = data.get('email') 
    
    invoice = Invoice.query.filter_by(payment_token=token).first()
    if not invoice:
        return jsonify({'message': 'Invalid invoice'}), 404

    if invoice.status == 'Paid':
        return jsonify({'message': 'Invoice is already paid'}), 400

    try:
        paystack_secret = os.environ.get('PAYSTACK_SECRET_KEY')
        url = "https://api.paystack.co/transaction/initialize"
        headers = {
            "Authorization": f"Bearer {paystack_secret}",
            "Content-Type": "application/json"
        }
        
        amount_cents = int(invoice.total * 100)
        
        # We direct the callback to the main.py route that handles logic
        payload = {
            "email": email,
            "amount": amount_cents,
            "callback_url": url_for('main.payment_callback', _external=True),
            "metadata": {
                "type": "invoice_payment",
                "invoice_id": invoice.id,
                "invoice_number": invoice.invoice_number
            }
        }
        
        response = requests.post(url, headers=headers, json=payload)
        response_data = response.json()
        
        if not response_data['status']:
            raise Exception(response_data['message'])

        # Save reference
        invoice.payment_reference = response_data['data']['reference']
        db.session.commit()

        return jsonify({
            'authorization_url': response_data['data']['authorization_url']
        })

    except Exception as e:
        print(f"Invoice Payment Init Error: {e}")
        return jsonify({'message': 'Could not initialize payment'}), 500
    
# ==========================================
# PUBLIC MVP ENDPOINTS (SINGLE TENANT)
# ==========================================

@bp.route('/public/services', methods=['GET'])
def public_get_services():
    """Fetches services for the public booking wizard (Hardcoded to Tenant 1)"""
    try:
        MVP_TENANT_ID = 1 
        categories = ServiceCategory.query.options(
            joinedload(ServiceCategory.items)
        ).filter_by(tenant_id=MVP_TENANT_ID).order_by(ServiceCategory.name).all()
        
        categories_data = []
        for category in categories:
            items_data = [{
                'id': item.id,
                'name': item.name,
                'description': item.description,
                'pricing_type': item.pricing_type,
                'default_rate': item.default_rate,
                'estimated_time_mins': item.estimated_time_mins,
                'is_extra': item.is_extra # NEW
            } for item in category.items]
            
            categories_data.append({
                'id': category.id,
                'name': category.name,
                'description': category.description,
                'calculation_method': category.calculation_method, # NEW (Tells JS which Flow to use)
                'prompt_question': category.prompt_question, # NEW (Tells JS what to ask)
                'items': items_data
            })
        return jsonify(categories_data), 200
    except Exception as e:
        print(f"Error fetching public services: {e}")
        return jsonify({"message": "Error fetching services."}), 500


# --- HELPER FUNCTION FOR GUEST ACCOUNTS ---
def get_or_create_guest_client(email, full_name, phone_number, address, tenant_id):
    """
    Checks if a user exists. If not, creates a 'Shadow Account'.
    Ensures the user has a Profile linked to the active tenant.
    Email sending is deferred until payment succeeds in the callback.
    """
    user = User.query.filter_by(email=email).first()
    
    if not user:
        # 1. Create the Shadow User (Instantly Confirmed!)
        random_pass = str(uuid.uuid4())
        user = User(
            email=email,
            password_hash=generate_password_hash(random_pass),
            role='client',
            is_confirmed=True, # <--- FIX: They can now log in immediately after setting a password
            password_reset_required=True,
            tenant_id=tenant_id
        )
        db.session.add(user)
        db.session.flush() # Get the user ID
        
    # 2. Guarantee a Profile exists for THIS tenant
    profile = Profile.query.filter_by(user_id=user.id, tenant_id=tenant_id).first()
    if not profile:
        profile = Profile(
            user_id=user.id,
            full_name=full_name,
            phone_number=phone_number,
            address=address,
            tenant_id=tenant_id
        )
        db.session.add(profile)
    
    # Notice: We completely removed the email logic here!
    
    return user

@bp.route('/public/book', methods=['POST'])
def public_submit_booking():
    data = request.get_json()
    if not data:
        return jsonify({"message": "No data provided."}), 400

    try:
        # SINGLE TENANT FIX: Grab the very first business account in the DB
        tenant = Tenant.query.first()
        active_tenant_id = tenant.id if tenant else 1
        
        user = get_or_create_guest_client(
            email=data.get('email'),
            full_name=data.get('full_name'),
            phone_number=data.get('phone_number'),
            address=data.get('address'),
            tenant_id=active_tenant_id
        )

        date_str = data.get('date', 'Unknown Date')
        time_str = data.get('time', '08:00')
        desc = f"Public Booking (Requested for {date_str} {time_str})"

        new_request = QuoteRequest(
            user_id=user.id,
            name=data.get('full_name'),
            email=data.get('email'),
            phone=data.get('phone_number'),
            address=data.get('address'),
            primary_service=data.get('service_name', 'General Clean'),
            service_frequency=data.get('frequency', 'Once-off'),
            description=desc, 
            total_price=data.get('estimated_total', 0.0),
            status='Pending', 
            tenant_id=active_tenant_id
        )
        db.session.add(new_request)
        db.session.commit()
        
        # CRITICAL FIX: Return the Quote ID so the frontend can hand it to Paystack
        return jsonify({"message": "Booking submitted successfully!", "quote_id": new_request.id}), 201
    except Exception as e:
        db.session.rollback()
        print(f"Error submitting public booking: {e}")
        return jsonify({"message": "An error occurred while processing your booking."}), 500
    
@bp.route('/staff/jobs/<int:job_id>/tasks', methods=['GET'])
@login_required
def get_job_checklist(job_id):
    """Fetches tasks for a job. Auto-generates them if they don't exist yet."""
    if current_user.role not in ['staff', 'admin']:
        return jsonify({"message": "Permission denied"}), 403

    job = Job.query.filter_by(id=job_id, tenant_id=current_user.tenant_id).first()
    if not job:
        return jsonify({"message": "Job not found"}), 404

    # AUTO-GENERATOR: If no tasks exist, build a checklist for today!
    if not job.tasks:
        # 1. Pull dynamic tasks directly from the ServiceItem template!
        if job.service and job.service.default_checklist:
            for task_name in job.service.default_checklist:
                db.session.add(JobTask(job_id=job.id, task_name=task_name, tenant_id=job.tenant_id))
        else:
            # Fallback just in case the Admin hasn't created a template for this service yet
            base_name = job.service.name if job.service else "Standard Service"
            db.session.add(JobTask(job_id=job.id, task_name=f"Complete {base_name}", tenant_id=job.tenant_id))
        
        # 2. Add any requested extras (If the quote request has them)
        if job.quote_request and job.quote_request.service_details:
             db.session.add(JobTask(job_id=job.id, task_name=f"Extras: {job.quote_request.service_details}", tenant_id=job.tenant_id))
        
        # 3. The Complimentary Rotational Deep Clean Task
        client_profile = job.client.profile if job.client else None
        rotational_name = client_profile.next_suggested_rotational_task if client_profile and client_profile.next_suggested_rotational_task else "Deep Scrub Master Shower Grout"
        
        db.session.add(JobTask(
            job_id=job.id, 
            task_name=f"[ROTATIONAL FOCUS] {rotational_name}", 
            is_rotational=True, 
            tenant_id=job.tenant_id
        ))
        db.session.commit()

    tasks_data = [{
        "id": t.id,
        "task_name": t.task_name,
        "is_rotational": t.is_rotational,
        "is_completed": t.is_completed
    } for t in job.tasks]
    client_profile = job.client.profile if job.client else None
    quote_req = job.quote_request
    
    job_info = {
        "id": job.id,
        "client_name": client_profile.full_name if client_profile else job.client.email,
        "address": quote_req.address if quote_req and quote_req.address else (client_profile.address if client_profile else "No address provided"),
        "service_name": job.service.name if job.service else "Standard Cleaning"
    }

    return jsonify({"job": job_info, "tasks": tasks_data}), 200

@bp.route('/staff/tasks/<int:task_id>/toggle', methods=['POST'])
@login_required
def toggle_job_task(task_id):
    """Marks a checklist item as complete or incomplete."""
    if current_user.role not in ['staff', 'admin']:
        return jsonify({"message": "Permission denied"}), 403

    task = JobTask.query.filter_by(id=task_id, tenant_id=current_user.tenant_id).first()
    if not task:
        return jsonify({"message": "Task not found"}), 404

    data = request.get_json()
    task.is_completed = data.get('is_completed', not task.is_completed)
    db.session.commit()

    return jsonify({"message": "Task updated", "is_completed": task.is_completed}), 200

@bp.route('/staff/jobs/<int:job_id>/photos', methods=['POST'])
@login_required
def upload_job_photo(job_id):
    """Handles uploading Before, After, and Issue photos from the staff's phone."""
    if current_user.role not in ['staff', 'admin']:
        return jsonify({"message": "Permission denied"}), 403

    job = Job.query.filter_by(id=job_id, tenant_id=current_user.tenant_id).first()
    if not job:
        return jsonify({"message": "Job not found"}), 404

    if 'photo' not in request.files:
        return jsonify({"message": "No photo provided"}), 400

    file = request.files['photo']
    photo_type = request.form.get('photo_type', 'General') # e.g., 'Before', 'After'
    task_id = request.form.get('task_id') # If tied to a specific rotational task

    if file and file.filename != '':
        filename = secure_filename(file.filename)
        # Create a unique filename so they never overwrite each other
        unique_filename = f"job_{job_id}_{str(uuid.uuid4())[:8]}_{filename}"
        upload_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
        
        file.save(upload_path)

        new_photo = JobPhoto(
            job_id=job.id,
            task_id=task_id if task_id else None,
            photo_type=photo_type,
            image_filename=unique_filename,
            uploaded_by_id=current_user.id,
            tenant_id=job.tenant_id
        )
        db.session.add(new_photo)
        db.session.commit()

        return jsonify({
            "message": "Photo uploaded successfully!", 
            "photo_url": f"/static/uploads/{unique_filename}",
            "photo_id": new_photo.id
        }), 201

    return jsonify({"message": "Invalid file"}), 400

@bp.route('/staff/jobs/<int:job_id>/complete', methods=['POST'])
@login_required
def complete_job_report(job_id):
    """Finalizes the job and updates the client's next rotational task."""
    if current_user.role not in ['staff', 'admin']:
        return jsonify({"message": "Permission denied"}), 403

    job = Job.query.filter_by(id=job_id, tenant_id=current_user.tenant_id).first()
    if not job:
        return jsonify({"message": "Job not found"}), 404

    data = request.get_json() or {}
    suggested_next_task = data.get('suggested_next_task')
    notes = data.get('notes', '')

    # 1. Update Job Status
    job.status = 'Completed'
    if notes:
        job.notes = (job.notes or "") + f"\n[Staff Report]: {notes}"
        
    # 2. Update Client Profile with the suggestion for next time!
    if suggested_next_task and job.client and job.client.profile:
        job.client.profile.next_suggested_rotational_task = suggested_next_task

    # 3. Log it
    log_activity(
        'Job Completed', 
        f"Staff '{current_user.email}' completed Job #{job.id}. Next focus: {suggested_next_task}", 
        tenant_id=job.tenant_id
    )

    db.session.commit()
    return jsonify({"message": "Job successfully completed!"}), 200

# 1. Connected Provider Room Setup
@socketio.on('join_tenant_room')
def handle_join_tenant_room(data):
    """When a provider logs onto their admin panel, they join their real-time listener room."""
    tenant_id = data.get('tenant_id')
    if tenant_id:
        join_room(f"tenant_{tenant_id}")
        print(f"Tenant room connection established for room: tenant_{tenant_id}")

# 2. Atomic Endpoint for Claiming the Lead
@bp.route('/admin/leads/<int:dispatch_id>/accept', methods=['POST'])
@login_required
def accept_lead(dispatch_id):
    """Enforces strict transactional safety when claiming a Quick Book."""
    if not current_user.is_authenticated or current_user.role != 'admin':
        return jsonify({"message": "Permission denied"}), 403

    # Fetch the dispatch row normally — it is per-tenant and uncontended.
    # The contended resource is the Job (see job lock below), not this row.
    dispatch = LeadDispatch.query.filter_by(
        id=dispatch_id,
        tenant_id=current_user.tenant_id
    ).first()

    if not dispatch:
        return jsonify({"message": "Lead window not found."}), 404

    if dispatch.status != 'pending' or datetime.utcnow() > dispatch.expires_at:
        return jsonify({"message": "Too slow! Lead request window has expired."}), 400

    # Lock the contended resource — the JOB — for the duration of this txn.
    # Two providers accepting *different* dispatch rows for the *same* job
    # would otherwise lock different rows and never block each other; the
    # winner check must run under the job lock to be race-free.
    job = db.session.query(Job).filter_by(id=dispatch.job_id).with_for_update().first()
    if job is None:
        return jsonify({"message": "Job no longer exists."}), 404

    # Race-free under the job lock: no other accept for this job can commit
    # until this transaction releases the lock.
    if job.tenant_id is not None or job.status != Job.STATUS_SEARCHING:
        dispatch.status = 'lost'
        db.session.commit()
        return jsonify({"message": "Another provider claimed this job first!"}), 400

    # 1. We have a winner!
    dispatch.status = 'won'
    
    # Batch update remaining active dispatches for this job to 'lost'
    db.session.query(LeadDispatch).filter(
        LeadDispatch.job_id == dispatch.job_id,
        LeadDispatch.id != dispatch.id
    ).update({"status": "lost"})
    
    # 2. Lock the Job to this specific Provider (already fetched under lock above)
    job.tenant_id = current_user.tenant_id
    job.status = Job.STATUS_AWAITING_PAYMENT
    
    # Fetch provider info to show the client
    provider_settings = BusinessSettings.query.filter_by(tenant_id=current_user.tenant_id).first()
    provider_name = provider_settings.business_name if provider_settings else "A Verified Pro"
    
    # 3. PING THE CLIENT'S SCREEN! 
    socketio.emit('pro_found', {
        'job_id': job.id,
        'provider_name': provider_name,
        'message': f"Pro Found! {provider_name} has accepted your request."
    }, room=f"client_job_{job.id}")
    
    log_activity('Quick Book Claimed', f"Admin secured Quick Book Job #{job.id}.", tenant_id=current_user.tenant_id)
    db.session.commit()

    return jsonify({"message": "Job secured! Waiting for client to finalize payment."}), 200

@bp.route('/api/user/me', methods=['GET'])
@login_required
def get_current_user_info():
    """Returns basic session context so the React frontend knows who is logged in."""
    return jsonify({
        "user_id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "tenant_id": getattr(current_user, 'tenant_id', None)
    }), 200