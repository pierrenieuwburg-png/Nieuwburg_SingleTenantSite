import json
import re
from datetime import date, datetime, timedelta
from math import radians, cos, sin, asin, sqrt
from .. import db, socketio
from ..models import BusinessSettings, LeadDispatch, Job, QuoteRequest, ActivityLog
from sqlalchemy import and_, or_, exists
from flask import current_app, render_template
from flask_mail import Message
from threading import Thread
import time
import traceback
from .. import db, mail
from ..models import ActivityLog, Quote, Invoice, Job, QuoteRequest, InvoiceLineItem, User
from flask_login import current_user
from markupsafe import Markup, escape
from io import BytesIO
from xhtml2pdf import pisa

def nl2br(value):
    """Converts newlines in text to HTML <br> tags."""
    if value is None:
        return ''
    escaped_value = escape(str(value)) 
    result = escaped_value.replace('\r\n', '<br>\n').replace('\n', '<br>\n')
    return Markup(result)

def send_async_email(app, msg):
    with app.app_context():
        #app.jinja_env.filters['nl2br'] = nl2br
        try:
            print(f"--- [Email Thread] --- Attempting to send email to {msg.recipients}...")
            start_time = time.time()
            mail.send(msg)
            end_time = time.time()
            print(f"--- [Email Thread] --- Email successfully sent to {msg.recipients}. (Took {end_time - start_time:.2f}s)")
        except Exception as e:
            print(f"!!! [Email Thread] --- FAILED to send email to {msg.recipients} !!!")
            print(f"Error: {e}")
            traceback.print_exc()

def log_activity(activity_type, description, user_id=None, tenant_id=None):
    """Logs an action to the ActivityLog table."""
    if user_id is None and current_user and current_user.is_authenticated:
        user_id = current_user.id
        
    # Automatically grab the tenant_id from the current user if not provided
    if tenant_id is None and current_user and current_user.is_authenticated:
        tenant_id = getattr(current_user, 'tenant_id', None)

    log = ActivityLog(
        activity_type=activity_type,
        description=description,
        user_id=user_id,
        tenant_id=tenant_id
    )
    db.session.add(log)
    db.session.commit()

def get_next_quote_number():
    """Generates the next sequential quote number for the CURRENT TENANT."""
    # TENANT AWARE: Filter by the current user's tenant
    last_quote = Quote.query.filter_by(
        tenant_id=current_user.tenant_id
    ).order_by(Quote.id.desc()).first()

    if not last_quote or '-' not in last_quote.quote_number:
        return "QU-0001" # Start fresh for every new tenant
    try:
        last_num = int(last_quote.quote_number.split('-')[1])
        new_num = last_num + 1
        return f"QU-{new_num:04d}"
    except (IndexError, ValueError):
        return "QU-0001"

def get_next_invoice_number():
    """Generates the next sequential invoice number for the CURRENT TENANT."""
    # TENANT AWARE: Filter by the current user's tenant
    last_invoice = Invoice.query.filter_by(
        tenant_id=current_user.tenant_id
    ).order_by(Invoice.id.desc()).first()

    if not last_invoice or '-' not in last_invoice.invoice_number:
        return "INV-0001" # Start fresh for every new tenant
    try:
        last_num = int(last_invoice.invoice_number.split('-')[1])
        new_num = last_num + 1
        return f"INV-{new_num:04d}"
    except (IndexError, ValueError):
        return "INV-0001"

def create_invoice_from_job(job):
    """Creates an invoice from a completed job's quote request."""
    if not job.quote_request or not job.quote_request.user:
        print(f"Cannot create invoice for job {job.id}: missing data.")
        return

    if Invoice.query.filter_by(quote_request_id=job.quote_request.id).first():
        print(f"Invoice already exists for quote request {job.quote_request.id}.")
        return

    new_invoice = Invoice(
        invoice_number=get_next_invoice_number(),
        user_id=job.quote_request.user.id,
        invoice_date=date.today(),
        due_date=date.today() + timedelta(days=30),
        subtotal=job.quote_request.total_price,
        total=job.quote_request.total_price,
        quote_request_id=job.quote_request.id
    )
    db.session.add(new_invoice)
    db.session.flush()

    try:
        service_details = json.loads(job.quote_request.service_details)
        description = f"Service: {job.quote_request.primary_service} ({job.quote_request.property_type})\n"
        for service in service_details:
            description += f"- {service.get('name')}"
            if 'quantity' in service and service.get('quantity') not in ['on', 'off']:
                 description += f" (Qty: {service.get('quantity')})"
            description += "\n"
        line_item = InvoiceLineItem(
            invoice_id=new_invoice.id, description=description.strip(),
            quantity=1, unit_price=job.quote_request.total_price,
            amount=job.quote_request.total_price
        )
        db.session.add(line_item)
    except (json.JSONDecodeError, TypeError):
        line_item = InvoiceLineItem(
            invoice_id=new_invoice.id, description=f"Service for {job.quote_request.primary_service}",
            quantity=1, unit_price=job.quote_request.total_price,
            amount=job.quote_request.total_price
        )
        db.session.add(line_item)
    
    log_activity('Invoice Auto-Generated', f"Invoice {new_invoice.invoice_number} for job {job.id}.", user_id=None)
    db.session.commit()
    print(f'Invoice {new_invoice.invoice_number} has been automatically generated.')

def render_template_to_pdf(template_name, **context):
    """Renders a Flask template to a PDF string."""
    html = render_template(template_name, **context)
    result = BytesIO()
    pdf = pisa.pisaDocument(BytesIO(html.encode("UTF-8")), result)
    if not pdf.err:
        return result.getvalue()
    else:
        print(f"!!! PDF Generation Error for {template_name} !!!")
        print(pdf.err)
        return None

def send_email_with_attachment(subject, recipients, html_body, 
                               attachment_data, attachment_filename, 
                               attachment_mimetype='application/octet-stream'):
    """Sends an email with an in-memory attachment using the async sender."""
    app = current_app._get_current_object()
    msg = Message(subject=subject,
                  sender=app.config['MAIL_USERNAME'],
                  recipients=recipients)
    msg.html = html_body

    # Add the attachment
    msg.attach(
        filename=attachment_filename,
        content_type=attachment_mimetype,
        data=attachment_data
    )

    # Send asynchronously
    thr = Thread(target=send_async_email, args=[app, msg])
    thr.start()
    print(f"--- [Email Main] --- Queued email with attachment for {recipients}")

def haversine_distance(lat1, lon1, lat2, lon2):
    """Calculates distance between two GPS coordinates in kilometers."""
    if not all([lat1, lon1, lat2, lon2]): 
        return 9999
    
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    a = sin((lat2 - lat1)/2)**2 + cos(lat1) * cos(lat2) * sin((lon2 - lon1)/2)**2
    return 2 * asin(sqrt(a)) * 6371

def resolve_price_for_job(job):
    """Single seam: 'what does this Quick Book job cost, in ZAR?'

    Pricing is master-admin-controlled and service-dependent (frequency-based,
    one-off-flat, or one-off-with-inputs) — it is NOT decided here, and is NOT a
    hard-coded rate or an assumed-frequency formula. The price is resolved from
    pricing inputs carried ON THE JOB, which are populated once the master-admin
    pricing catalog + frequency capture exist (see BACKLOG #7).

    Until those inputs exist there is no usable price for any job, so this
    returns None and the caller MUST refuse (charge nothing). Returns a positive
    float amount in ZAR, or None if no usable price is available yet.

    Lives here (not in client.py) so both the payment-init endpoint and the
    timeout sweep can import it without a circular import.
    """
    # TODO (BACKLOG #7): resolve from the master-admin pricing catalog using the
    # job's service category + the frequency/inputs captured on the Job. No such
    # inputs are stored on the Job yet, so no price is resolvable today — every
    # job is currently unpriced and the payment-init endpoint refuses.
    return None


def dispatch_live_job(job):
    """Triggered when a client searches for a pro for a Quick Book job."""
    active_providers = BusinessSettings.query.filter_by(is_accepting_leads=True).all()
    window_seconds = current_app.config['QUICK_BOOK_DISPATCH_WINDOW_SECONDS']

    for provider in active_providers:
        # Calculate distance between the client's map pin and the provider's HQ
        distance = haversine_distance(
            job.latitude, job.longitude,
            provider.latitude, provider.longitude
        )
        
        # Default to 25km if the provider hasn't set a radius
        if distance <= (provider.service_radius_km or 25.0):
            
            # 1. Create the dispatch window tied to the JOB (duration from config —
            #    the SAME value the timeout sweep ages against, no drift).
            dispatch = LeadDispatch(
                job_id=job.id,
                tenant_id=provider.tenant_id,
                expires_at=datetime.utcnow() + timedelta(seconds=window_seconds)
            )
            db.session.add(dispatch)
            db.session.flush() 
            
            service_name = job.service.name if job.service else "Quick Book Service"
            
            # 2. THE BROADCAST to the provider's screen
            socketio.emit('incoming_lead', {
                'dispatch_id': dispatch.id,
                'service': service_name,
                'description': "Quick Book Request! Client is waiting for a match.",
                'distance_km': round(distance, 1),
                'expires_in_seconds': window_seconds
            }, room=f"tenant_{provider.tenant_id}")

    db.session.commit()


# =========================================================
# Quick Book timeout sweep (P1-4)
# When a Quick Book job's dispatch window passes with no winner, repost it as a
# floating marketplace lead (Engine B). Conversion is atomic and exactly-once
# per job: the locked re-assert of status=='Searching' is the latch.
# =========================================================

def _find_timed_out_quick_book_job_ids():
    """Ids of 'Searching' Quick Book jobs whose window passed with no winner.
      (a) has >=1 dispatch and NONE is still active (all expires_at < now); or
      (b) has ZERO dispatches and is older than the window (no providers in range).
    Reads the SAME window config dispatch_live_job uses — no drift. A 'Searching'
    status already implies no winner (accept_lead moves the job off 'Searching')."""
    now = datetime.utcnow()
    window = current_app.config['QUICK_BOOK_DISPATCH_WINDOW_SECONDS']
    cutoff = now - timedelta(seconds=window)

    has_any_dispatch = exists().where(LeadDispatch.job_id == Job.id)
    has_active_dispatch = exists().where(
        and_(LeadDispatch.job_id == Job.id, LeadDispatch.expires_at >= now)
    )

    arm_a = and_(has_any_dispatch, ~has_active_dispatch)        # all windows expired
    arm_b = and_(~has_any_dispatch, Job.created_at < cutoff)    # zero providers, aged out

    rows = Job.query.filter(
        Job.status == Job.STATUS_SEARCHING,
        or_(arm_a, arm_b)
    ).with_entities(Job.id).all()
    return [r[0] for r in rows]


def convert_job_to_floating_lead(job_id):
    """Lock the Job row, re-assert it is still 'Searching' UNDER the lock (the
    exactly-once latch), then flip it to 'Expired' and create a floating
    marketplace lead carrying the fixed Quick Book price. Returns the new
    QuoteRequest id if this call converted the job, else None (another tick or a
    last-moment accept already moved it). Mirrors accept_lead's P0-3 job lock;
    does not touch accept_lead."""
    job = db.session.query(Job).filter_by(id=job_id).with_for_update().first()
    if job is None:
        db.session.rollback()
        return None

    # Race-free under the job lock: if accept_lead won, or a prior tick already
    # converted, the status is no longer 'Searching' -> skip (no double convert).
    if job.status != Job.STATUS_SEARCHING:
        db.session.rollback()
        return None

    window = current_app.config['QUICK_BOOK_DISPATCH_WINDOW_SECONDS']
    client = job.client

    # Engine B floating lead. Carries the FIXED Quick Book price from the pricing
    # seam (None until BACKLOG #7 — hollow for now, that's expected).
    floating = QuoteRequest(
        user_id=job.client_id,
        name=(client.profile.full_name if client and client.profile else None),
        email=(client.email if client else None),
        primary_service=(job.service.name if job.service else None),
        service_category_name=(job.service.category.name if job.service and job.service.category else None),
        total_price=resolve_price_for_job(job),
        description=f"Quick Book auto-reposted: no pro accepted within {window}s (origin job #{job.id}).",
        latitude=job.latitude,
        longitude=job.longitude,
        marketplace_status='floating',
        tenant_id=None,
        status='Pending',
        request_date=datetime.utcnow(),
    )
    db.session.add(floating)
    db.session.flush()  # assign floating.id

    # Identity hook (built now; matching/dedup logic is the future re-run ticket):
    # link origin job <-> floating request so a re-run can find it by email +
    # this job/request reference and avoid duplicate floating leads.
    job.quote_request_id = floating.id
    job.status = Job.STATUS_EXPIRED

    # ActivityLog written directly (not via log_activity): keeps a SINGLE explicit
    # commit for the locked conversion and avoids the request-context current_user
    # lookup, which has no meaning in this background thread.
    db.session.add(ActivityLog(
        activity_type='Quick Book Expired',
        description=f"Job #{job.id} reposted as floating lead #{floating.id} (no pro within {window}s).",
        user_id=job.client_id,
        tenant_id=None,
    ))
    db.session.commit()
    return floating.id


def run_dispatch_sweep_tick(app):
    """One sweep pass (safe to run repeatedly): find timed-out Quick Book jobs and
    convert each under its own job lock, emitting 'no_pro_found' to the client room
    after each successful conversion."""
    with app.app_context():
        try:
            job_ids = _find_timed_out_quick_book_job_ids()
        except Exception:
            db.session.rollback()
            current_app.logger.exception("Dispatch sweep: candidate query failed")
            return

        for job_id in job_ids:
            try:
                floating_id = convert_job_to_floating_lead(job_id)
            except Exception:
                db.session.rollback()
                current_app.logger.exception("Dispatch sweep: failed converting job #%s", job_id)
                continue

            if floating_id is not None:
                current_app.logger.info("Quick Book job #%s expired -> floating lead #%s", job_id, floating_id)
                # Symmetric with 'pro_found'. Lands nowhere until P2-1 wires the
                # client listener — emitted now for forward-compatibility.
                socketio.emit('no_pro_found', {
                    'job_id': job_id,
                    'floating_lead_id': floating_id,
                    'message': "No pro grabbed it instantly — we've posted it for custom quotes."
                }, room=f"client_job_{job_id}")


def start_dispatch_sweeper(app):
    """Launch the background timeout sweeper. Call ONCE from run.py (the server
    entrypoint) — NOT from create_app — so `flask db ...`/seed never spawn it.
    Guarded by DISPATCH_SWEEPER_ENABLED. Multi-worker caveat: each worker would
    run its own sweep; safe today because the locked flip is idempotent (see
    BACKLOG)."""
    if not app.config.get('DISPATCH_SWEEPER_ENABLED', True):
        app.logger.warning("Dispatch sweeper disabled by config; not starting.")
        return
    interval = app.config.get('DISPATCH_SWEEPER_INTERVAL_SECONDS', 12)

    def _loop():
        while True:
            socketio.sleep(interval)   # sleep first: don't sweep instantly on boot
            run_dispatch_sweep_tick(app)

    socketio.start_background_task(_loop)
    app.logger.warning("Dispatch sweeper started (interval=%ss).", interval)