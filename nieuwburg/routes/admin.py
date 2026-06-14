import os
from flask import (Blueprint, render_template, redirect, url_for, flash,
                   request, jsonify, current_app)
from flask_login import login_required, current_user
from functools import wraps
from flask_mail import Message

from .. import db
from ..models import User, Quote, Invoice, QuoteRequest
from .utils import log_activity, send_async_email
from .auth import generate_confirmation_token

bp = Blueprint('admin', __name__, url_prefix='/admin')

# --- Admin Decorator ---
def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != 'admin':
            flash('You do not have permission to access this page.', 'error')
            return redirect(url_for('main.index'))
        return f(*args, **kwargs)
    return decorated_function

# --- Server-Side Admin Actions ---

@bp.route('/clients/delete/<int:user_id>', methods=['POST'])
@admin_required
def delete_client(user_id):
    client_to_delete = db.session.get(User, user_id)
    if client_to_delete and client_to_delete.role == 'client' and client_to_delete.tenant_id == current_user.tenant_id:
        db.session.delete(client_to_delete)
        log_activity('Client Deleted', f"Admin deleted client: {client_to_delete.email}")
        db.session.commit()
        return jsonify({'status': 'ok', 'message': 'Client deleted.'})
    return jsonify({'status': 'error', 'message': 'User not found or permission denied.'}), 404

@bp.route('/staff/delete/<int:user_id>', methods=['POST'])
@admin_required
def delete_staff(user_id):
    staff_to_delete = db.session.get(User, user_id)
    if staff_to_delete and staff_to_delete.role == 'staff' and staff_to_delete.tenant_id == current_user.tenant_id:
        db.session.delete(staff_to_delete)
        log_activity('Staff Deleted', f"Admin deleted staff: {staff_to_delete.email}")
        db.session.commit()
        return jsonify({'status': 'ok', 'message': 'Staff member deleted.'})
    return jsonify({'status': 'error', 'message': 'User not found or permission denied.'}), 404

@bp.route('/staff/reset-password/<int:user_id>', methods=['POST'])
@admin_required
def reset_staff_password(user_id):
    staff_member = db.session.get(User, user_id)
    if not staff_member or staff_member.role != 'staff' or staff_member.tenant_id != current_user.tenant_id:
        return jsonify({'status': 'error', 'message': 'Staff member not found.'}), 404

    staff_member.password_reset_required = True
    db.session.commit()

    if staff_member.email:
        try:
            token = generate_confirmation_token(staff_member.id)
            activation_url = url_for('auth.staff_activate_token', token=token, _external=True)
            msg = Message(subject="[Nieuwburg Blitz] Password Reset", sender=current_app.config['MAIL_USERNAME'], recipients=[staff_member.email])
            msg.body = f"Please click here to reset your password: {activation_url}"
            send_async_email(current_app._get_current_object(), msg)
            return jsonify({'status': 'ok', 'message': 'Reset email sent.'})
        except Exception as e:
            return jsonify({'status': 'warning', 'message': f'Error sending email: {e}'})
    
    return jsonify({'status': 'warning', 'message': 'User has no email.'})

@bp.route('/quotes/view/<int:quote_id>')
@admin_required
def view_quote_details(quote_id):
    """
    Server-side view for Quote Request details.
    Useful if you haven't migrated this specific view to React yet.
    """
    quote = db.session.get(QuoteRequest, quote_id)
    # Tenant Security Check
    if not quote or quote.tenant_id != current_user.tenant_id:
        flash('Quote request not found or permission denied.', 'error')
        return redirect(url_for('admin.admin_spa_shell'))

    return render_template('admin/admin_view_quote.html', quote=quote)

@bp.route('/quotes/delete/<int:quote_id>', methods=['POST'])
@admin_required
def delete_quote(quote_id):
    quote = db.session.get(Quote, quote_id)
    if quote and quote.tenant_id == current_user.tenant_id:
        db.session.delete(quote)
        db.session.commit()
        log_activity('Quote Deleted', f"Admin '{current_user.email}' deleted quote {quote.quote_number}")
        return jsonify({'status': 'ok', 'message': 'Quote deleted.'})
    return jsonify({'status': 'error', 'message': 'Quote not found or permission denied.'}), 404

@bp.route('/invoices/delete/<int:invoice_id>', methods=['POST'])
@admin_required
def delete_invoice(invoice_id):
    invoice = db.session.get(Invoice, invoice_id)
    if invoice and invoice.tenant_id == current_user.tenant_id:
        db.session.delete(invoice)
        db.session.commit()
        log_activity('Invoice Deleted', f"Admin '{current_user.email}' deleted invoice {invoice.invoice_number}")
        return jsonify({'status': 'ok', 'message': 'Invoice deleted.'})
    return jsonify({'status': 'error', 'message': 'Invoice not found or permission denied.'}), 404

# --- Setup Wizard Route (Server-Side Render) ---
@bp.route('/setup-wizard', methods=['GET'])
@login_required
@admin_required
def setup_wizard():
    """
    Serves the Setup Wizard HTML container.
    """
    return render_template('admin/setup_wizard.html', business_name=current_user.tenant.business_name)

@bp.route('/verify', methods=['GET', 'POST'])
@login_required
@admin_required
def verification_upload():
    tenant = current_user.tenant
    
    if request.method == 'POST':
        # 1. Handle File Uploads
        uploaded_files = {}
        
        # Define expected fields (you can make this dynamic based on industry later)
        doc_types = ['trade_certificate', 'business_registration', 'liability_insurance']
        
        files_found = False
        for doc_field in doc_types:
            file = request.files.get(doc_field)
            if file and file.filename != '':
                filename = secure_filename(f"{tenant.id}_{doc_field}_{file.filename}")
                save_path = os.path.join(current_app.config['UPLOAD_FOLDER'], 'compliance', filename)
                
                # Ensure directory exists
                os.makedirs(os.path.dirname(save_path), exist_ok=True)
                
                file.save(save_path)
                uploaded_files[doc_field] = filename
                files_found = True
        
        if not files_found:
            flash("Please upload at least one document.", "error")
            return redirect(request.url)

        # 2. Update Tenant Status
        tenant.compliance_docs = uploaded_files # Save paths to DB
        tenant.verification_status = 'pending'  # Lock them in pending mode
        db.session.commit()
        
        # 3. Log & Notify
        log_activity('Verification Submitted', f"Tenant {tenant.business_name} submitted docs for review.")
        flash("Documents submitted successfully! We will review them shortly.", "success")
        return redirect(url_for('admin.admin_spa_shell', path='dashboard'))

    return render_template('admin/verification_upload.html', tenant=tenant)

# --- SPA Catch-All Route ---
# Catches all other /admin/* routes and serves the React App
@bp.route('/', defaults={'path': ''})
@bp.route('/<path:path>')
@admin_required
def admin_spa_shell(path):
    return render_template('admin/admin_base.html')