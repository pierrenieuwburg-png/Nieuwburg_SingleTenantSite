import os
import requests
import traceback
from flask import Blueprint, render_template, redirect, url_for, flash, request, current_app, jsonify
from flask_login import login_required, current_user, login_user, logout_user
from flask_mail import Message
from datetime import date

from .. import db, mail
from ..models import Post, User, Quote, Invoice, QuoteRequest, Job, Tenant
from ..forms import PlacementApplicationForm
from .auth import generate_confirmation_token
from .utils import send_async_email


bp = Blueprint('main', __name__)

# --- Public Facing Page Routes ---

@bp.route('/')
def index():
    maps_key = current_app.config.get('GOOGLE_MAPS_API_KEY')
    return render_template('public/index.html')

@bp.route('/blog')
def blog():
    posts = Post.query.filter_by(is_published=True).order_by(Post.created_date.desc()).all()
    return render_template('public/blog.html', posts=posts)

@bp.route('/blog/<int:post_id>')
def post_detail(post_id):
    post = db.session.get(Post, post_id)
    if not post or (not post.is_published and (not current_user.is_authenticated or current_user.role != 'admin')):
        flash('Post not found.', 'error')
        return redirect(url_for('main.blog'))
    return render_template('public/post_detail.html', post=post)

@bp.route('/faq')
def faq():
    return render_template('public/faq.html')

@bp.route('/gallery')
def gallery():
    return render_template('public/gallery.html')

@bp.route('/blitz-dock')
def blitz_dock():
    return render_template('public/blitz_dock.html')

@bp.route('/about-us')
def about_us():
    return render_template('public/about.html')

@bp.route('/pricing')
def pricing():
    return render_template('public/pricing.html')

@bp.route('/subscribe/<plan_type>')
def subscribe(plan_type):
    if plan_type not in ['basic', 'intermediate', 'pro']:
        flash('Invalid subscription plan.', 'error')
        return redirect(url_for('main.index', _anchor='pricing-section'))
    return render_template('public/subscribe.html', plan_type=plan_type)

# --- Placements Routes ---

@bp.route('/placements/housekeeper')
def housekeeper_placement():
    return render_template('placements/housekeeper.html')

@bp.route('/placements/nanny')
def nanny_placement():
    return render_template('placements/nanny.html')

@bp.route('/placements/carer')
def carer_placement():
    return render_template('placements/carer.html')

@bp.route('/placements/apply/<service_type>', methods=['GET', 'POST'])
def placement_apply(service_type):
    if service_type not in ['housekeeper', 'nanny', 'carer']:
        return redirect(url_for('main.index'))
    form = PlacementApplicationForm()
    if form.validate_on_submit():
        flash('Thank you for your application! We will be in contact with you shortly.', 'success')
        return redirect(url_for('main.index'))
    return render_template('placements/placement_apply.html', form=form, service_type=service_type)


# --- Authenticated User Dashboards ---

@bp.route('/dashboard')
@login_required
def client_dashboard():
    if current_user.role == 'admin':
        return redirect(url_for('admin.admin_spa_shell'))
    if current_user.role == 'staff':
        return redirect(url_for('main.staff_dashboard'))

    user_bookings = QuoteRequest.query.filter_by(user_id=current_user.id).order_by(QuoteRequest.request_date.desc()).all()
    user_quotes = Quote.query.filter_by(user_id=current_user.id).order_by(Quote.quote_date.desc()).all()
    user_invoices = Invoice.query.filter_by(user_id=current_user.id).order_by(Invoice.invoice_date.desc()).all()
    
    return render_template(
        'client/client_dashboard.html', 
        bookings=user_bookings,
        quotes=user_quotes,
        invoices=user_invoices
    )

@bp.route('/staff/dashboard')
@login_required
def staff_dashboard():
    if current_user.role != 'staff':
        flash('Access denied.', 'error')
        return redirect(url_for('main.index'))

    today = date.today()
    assigned_jobs = Job.query.options(
        db.joinedload(Job.quote_request).joinedload(QuoteRequest.user).joinedload(User.profile),
        db.joinedload(Job.assigned_staff).joinedload(User.profile)
    ).filter(Job.assigned_staff.any(id=current_user.id)).order_by(Job.scheduled_date, Job.start_time).all()

    upcoming_jobs = [j for j in assigned_jobs if j.scheduled_date >= today]
    past_jobs = [j for j in assigned_jobs if j.scheduled_date < today]

    return render_template('staff/staff_dashboard.html', upcoming_jobs=upcoming_jobs, past_jobs=past_jobs)


# --- Payment & Invoicing Routes (New) ---

@bp.route('/invoice/pay/<token>')
def public_invoice_pay(token):
    """
    Public page for a client to view and pay their invoice.
    """
    invoice = Invoice.query.filter_by(payment_token=token).first()
    
    if not invoice:
        return render_template('public/error.html', message="Invoice not found or invalid link."), 404
        
    paystack_key = os.environ.get('PAYSTACK_PUBLIC_KEY')
    
    # Get Tenant details for display
    tenant = Tenant.query.get(invoice.tenant_id)
    business_name = tenant.business_name if tenant else "Nieuwburg Blitz"

    return render_template(
        'public/pay_invoice.html', 
        invoice=invoice, 
        paystack_key=paystack_key,
        business_name=business_name
    )

@bp.route('/api/invoice/initiate-payment', methods=['POST'])
def initiate_invoice_payment():
    """
    Called by the frontend to start a Paystack transaction for an INVOICE.
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


@bp.route('/payment-callback')
def payment_callback():
    reference = request.args.get('reference')
    if not reference:
        flash('No payment reference provided.', 'error')
        return redirect(url_for('main.pricing'))

    try:
        # 1. Verify Transaction
        paystack_secret = os.environ.get('PAYSTACK_SECRET_KEY')
        headers = {"Authorization": f"Bearer {paystack_secret}"}
        verify_url = f"https://api.paystack.co/transaction/verify/{reference}"
        
        response = requests.get(verify_url, headers=headers)
        response_data = response.json()

        if not response_data['status']:
            flash(f"Payment verification failed: {response_data['message']}", 'error')
            return redirect(url_for('main.pricing'))

        data = response_data['data']
        metadata = data.get('metadata', {})
        
        if data['status'] == 'success':
            # ---------------------------------------------------------
            # SCENARIO A: SUBSCRIPTION PAYMENT (New Tenant or Upgrade)
            # ---------------------------------------------------------
            if 'plan_type' in metadata:
                tenant_id = metadata.get('tenant_id')
                user_id = metadata.get('user_id')
                
                # Activate Tenant
                tenant = Tenant.query.get(tenant_id)
                if tenant:
                    tenant.is_active = True
                    tenant.paystack_reference = reference
                
                # Activate User
                user = User.query.get(user_id)
                if user:
                    user.is_confirmed = True
                    user.confirmed_on = datetime.utcnow()
                    
                    # Force Login (Handles both new and upgraded users)
                    login_user(user)
                
                db.session.commit()
                
                flash("Payment successful! Welcome to Nieuwburg Blitz.", 'success')
                
                # FIX: Redirect to Setup Wizard instead of Dashboard
                return redirect(url_for('admin.admin_spa_shell', path='setup-wizard'))

            # ---------------------------------------------------------
            # SCENARIO B: INVOICE PAYMENT
            # ---------------------------------------------------------
            elif metadata.get('type') == 'invoice_payment':
                invoice_id = metadata.get('invoice_id')
                invoice = Invoice.query.get(invoice_id)
                if invoice:
                    invoice.status = 'Paid'
                    invoice.payment_reference = reference
                    db.session.commit()
                    return redirect(url_for('main.public_invoice_pay', token=invoice.payment_token))
            
            # ---------------------------------------------------------
            # SCENARIO C: QUOTE DEPOSIT
            # ---------------------------------------------------------
            elif 'quote_id' in metadata:
                quote_id = metadata.get('quote_id')
                quote = Quote.query.get(quote_id)
                if quote:
                    quote.deposit_paid = True
                    quote.status = 'Accepted' # Auto-accept on deposit
                    db.session.commit()
                    flash('Deposit received. Quote accepted!', 'success')
                    # Redirect to the quote view
                    return redirect(url_for('main.public_quote_view', token=quote.acceptance_token))

        else:
            flash('Payment was not successful.', 'error')
            return redirect(url_for('main.pricing'))

    except Exception as e:
        print(f"Payment Callback Error: {e}")
        flash('An error occurred verifying payment.', 'error')
        return redirect(url_for('main.index'))

    return redirect(url_for('main.index'))


@bp.route('/check-email')
def check_email():
    return render_template('public/check_email.html')