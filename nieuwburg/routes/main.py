import os
import requests
import traceback
from flask import Blueprint, render_template, redirect, url_for, flash, request, current_app, jsonify
from flask_login import login_required, current_user, login_user, logout_user
from flask_mail import Message
from datetime import datetime, date

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
        return redirect(url_for('main.index'))

    try:
        # 1. Verify Transaction
        paystack_secret = os.environ.get('PAYSTACK_SECRET_KEY')
        headers = {"Authorization": f"Bearer {paystack_secret}"}
        verify_url = f"https://api.paystack.co/transaction/verify/{reference}"
        
        response = requests.get(verify_url, headers=headers)
        response_data = response.json()

        if not response_data.get('status'):
            flash(f"Payment verification failed: {response_data.get('message')}", 'error')
            return redirect(url_for('main.index'))

        data = response_data.get('data', {})
        raw_metadata = data.get('metadata') or {}
        
        # --- THE ULTIMATE METADATA EXTRACTOR ---
        metadata = {}
        if isinstance(raw_metadata, dict):
            metadata = raw_metadata
        elif isinstance(raw_metadata, str):
            import json
            try:
                metadata = json.loads(raw_metadata)
            except Exception:
                pass
                
        meta_type = metadata.get('type')
        quote_id = metadata.get('quote_id')
        
        # Paystack Custom Fields fallback
        if not meta_type and 'custom_fields' in metadata:
            for field in metadata['custom_fields']:
                if field.get('variable_name') == 'type':
                    meta_type = field.get('value')
                if field.get('variable_name') == 'quote_id':
                    quote_id = field.get('value')
        
        if data.get('status') == 'success':
            # ---------------------------------------------------------
            # SCENARIO A: SUBSCRIPTION PAYMENT
            # ---------------------------------------------------------
            if 'plan_type' in metadata:
                tenant_id = metadata.get('tenant_id')
                user_id = metadata.get('user_id')
                
                tenant = Tenant.query.get(tenant_id)
                if tenant:
                    tenant.is_active = True
                    tenant.paystack_reference = reference
                
                user = User.query.get(user_id)
                if user:
                    user.is_confirmed = True
                    user.confirmed_on = datetime.utcnow()
                    login_user(user)
                
                db.session.commit()
                flash("Payment successful! Welcome to Nieuwburg Blitz.", 'success')
                return redirect(url_for('admin.admin_spa_shell', path='setup-wizard'))

            # ---------------------------------------------------------
            # SCENARIO B: INVOICE PAYMENT
            # ---------------------------------------------------------
            elif meta_type == 'invoice_payment':
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
            elif 'quote_id' in metadata and meta_type != 'public_booking':
                quote_id = metadata.get('quote_id')
                quote = Quote.query.get(quote_id)
                if quote:
                    quote.deposit_paid = True
                    quote.status = 'Accepted' 
                    db.session.commit()
                    flash('Deposit received. Quote accepted!', 'success')
                    return redirect(url_for('main.public_quote_view', token=quote.acceptance_token))

            # ---------------------------------------------------------
            # SCENARIO D: PUBLIC WIZARD BOOKING (THE FIX)
            # ---------------------------------------------------------
            elif meta_type == 'public_booking':
                
                if quote_id:
                    from ..models import QuoteRequest, Job, ServiceItem, User
                    from .utils import log_activity, send_async_email
                    from flask_mail import Message
                    from itsdangerous import URLSafeTimedSerializer
                    from threading import Thread
                    
                    quote_req = QuoteRequest.query.get(quote_id)

                    if quote_req and quote_req.status in ['Pending', 'New']:
                        # 1. Update status so it vanishes from Quotes
                        quote_req.status = 'Confirmed'
                        
                        # 2. Add to Job Calendar
                        service_item = ServiceItem.query.filter_by(
                            name=quote_req.primary_service, 
                            tenant_id=quote_req.tenant_id
                        ).first()
                        
                        sched_date = date.today()
                        start_time = datetime.strptime("08:00", "%H:%M").time()
                        
                        try:
                            if "(Requested for " in quote_req.description:
                                time_part = quote_req.description.split("(Requested for ")[1].split(")")[0]
                                d_str, t_str = time_part.split(" ")
                                sched_date = datetime.strptime(d_str, "%Y-%m-%d").date()
                                start_time = datetime.strptime(t_str, "%H:%M").time()
                        except Exception as e:
                            print(f"Time parsing failed: {e}")

                        new_job = Job(
                            quote_request_id=quote_req.id,
                            client_id=quote_req.user_id,
                            service_id=service_item.id if service_item else None,
                            scheduled_date=sched_date,
                            start_time=start_time,
                            status='Scheduled',
                            notes=f"Paid upfront via Paystack. Ref: {reference}",
                            tenant_id=quote_req.tenant_id
                        )
                        db.session.add(new_job)
                        
                        # 3. Trigger the Welcome Email NOW (Behind the Paywall)
                        user = User.query.get(quote_req.user_id)
                        if user and getattr(user, 'password_reset_required', False):
                            serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
                            token = serializer.dumps(user.email, salt=current_app.config.get('SECURITY_PASSWORD_SALT', 'my_precious_salt'))
                            setup_url = url_for('auth.reset_password', token=token, _external=True)
                            
                            client_name = quote_req.name or "Valued Client"
                            email_html = f"""
                            <h3>Hi {client_name},</h3>
                            <p>Your payment was successful and your booking with Nieuwburg Blitz is confirmed!</p>
                            <p>We've created a secure dashboard for you to track your cleaner, view your service history, and manage your property.</p>
                            <p><a href="{setup_url}" style="display:inline-block;padding:10px 20px;background-color:#006ac6;color:white;text-decoration:none;border-radius:5px;">Click here to set your password and access your dashboard</a></p>
                            <p>Welcome to the Blitz family!</p>
                            """
                            
                            msg = Message(
                                subject="Booking Confirmed! Complete your setup.",
                                sender=current_app.config.get('MAIL_USERNAME', 'noreply@nieuwburg.com'),
                                recipients=[user.email],
                                html=email_html
                            )
                            
                            app = current_app._get_current_object()
                            thr = Thread(target=send_async_email, args=[app, msg])
                            thr.start()
                        
                        log_activity('Public Booking Paid', f"Job #{new_job.id} created from upfront payment.", tenant_id=quote_req.tenant_id)
                        db.session.commit()

                # Redirect back to homepage with Toast flags attached
                return redirect(url_for('main.index', booking_success='true', new_user='true'))

        else:
            flash('Payment was not successful.', 'error')
            return redirect(url_for('main.index'))

    except Exception as e:
        print(f"Payment Callback Error: {e}")
        import traceback
        traceback.print_exc()
        flash('An error occurred verifying payment.', 'error')
        return redirect(url_for('main.index'))

    return redirect(url_for('main.index'))

@bp.route('/check-email')
def check_email():
    return render_template('public/check_email.html')

# --- Public API Routes ---

@bp.route('/api/request-quote', methods=['POST'])
def request_quote():
    data = request.get_json()
    
    name = data.get('name')
    email = data.get('email')
    phone = data.get('phone')
    subject = data.get('subject')
    description = data.get('description')
    
    if not name or not email or not subject:
        return jsonify({'message': 'Please fill in all required fields.'}), 400
        
    try:
        # Create the new record AND set the exact request date
        new_request = QuoteRequest( 
            name=name,
            email=email,
            phone=phone,
            subject=subject,
            description=description,
            status='Pending',
            request_date=datetime.utcnow()  # <-- FIX: Forces it to show up on the dashboard
        )
        
        if current_user.is_authenticated:
            new_request.user_id = current_user.id
            
        db.session.add(new_request)
        db.session.commit()
        
        # --- SEND EMAIL NOTIFICATION ---
        try:
            # Make sure these are imported at the top of main.py if they aren't already:
            from threading import Thread
            from flask import current_app
            from flask_mail import Message
            from .utils import send_async_email

            html_body = render_template(
                'email/admin_quote_notification.html',
                data={
                    'name': name,
                    'email': email,
                    'phone': phone,
                    'address': 'Not required for this inquiry', 
                    'description': description
                },
                category_name=subject,
                logo_url=url_for('static', filename='img/LogoBlackWithTitle.png', _external=True)
            )
            
            # Build the message object
            msg = Message(
                subject=f"New Lead Alert: {subject}",
                sender=current_app.config.get('MAIL_USERNAME', 'noreply@nieuwburg.com'),
                recipients=["peerinnoveer@gmail.com"],
                html=html_body
            )
            
            # Grab the actual application context and fire the thread
            app = current_app._get_current_object()
            thr = Thread(target=send_async_email, args=[app, msg])
            thr.start()
            
        except Exception as email_err:
            print(f"Warning: Email failed to set up - {email_err}")

        
        return jsonify({
            'status': 'ok', 
            'message': 'Inquiry submitted successfully! We will contact you shortly.'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        print(f"Error saving quote: {e}")
        return jsonify({'message': 'A database error occurred. Please try again.'}), 500