import re
import uuid
from . import db
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy.types import JSON
from datetime import datetime, date, time
from itsdangerous import URLSafeTimedSerializer as Serializer
from flask import current_app

# --- TENANT MODEL ---
class Tenant(db.Model):
    __tablename__ = 'tenant'
    id = db.Column(db.Integer, primary_key=True)
    business_name = db.Column(db.String(100), nullable=False)
    subscription_plan = db.Column(db.String(50), nullable=False) 
    paystack_reference = db.Column(db.String(100), unique=True, nullable=True)
    is_active = db.Column(db.Boolean, default=False, nullable=False) 
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    verification_status = db.Column(db.String(20), default='unverified', nullable=False)
    compliance_docs = db.Column(JSON, nullable=True)
    admin_notes = db.Column(db.Text, nullable=True)

    users = db.relationship('User', back_populates='tenant', lazy=True)
    business_settings = db.relationship('BusinessSettings', back_populates='tenant', uselist=False, cascade="all, delete-orphan")
    quotes = db.relationship('Quote', back_populates='tenant', lazy=True)
    invoices = db.relationship('Invoice', back_populates='tenant', lazy=True)
    clients = db.relationship('Profile', back_populates='tenant', lazy=True)
    service_categories = db.relationship('ServiceCategory', back_populates='tenant', lazy=True)
    service_items = db.relationship('ServiceItem', back_populates='tenant', lazy=True)
    service_clauses = db.relationship('ServiceClause', back_populates='tenant', lazy=True)
    quote_requests = db.relationship('QuoteRequest', back_populates='tenant', lazy=True)
    jobs = db.relationship('Job', back_populates='tenant', lazy=True)
    posts = db.relationship('Post', back_populates='tenant', lazy=True)
    activities = db.relationship('ActivityLog', back_populates='tenant', lazy=True)

# --- ASSOCIATION TABLES ---
job_staff_association = db.Table('job_staff_association',
    db.Column('job_id', db.Integer, db.ForeignKey('job.id'), primary_key=True),
    db.Column('user_id', db.Integer, db.ForeignKey('user.id'), primary_key=True)
)

service_clauses_association = db.Table('service_clauses_association',
    db.Column('service_item_id', db.Integer, db.ForeignKey('service_item.id'), primary_key=True),
    db.Column('service_clause_id', db.Integer, db.ForeignKey('service_clause.id'), primary_key=True)
)

# --- USER & PROFILE ---
class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), unique=True, nullable=True)
    password_hash = db.Column(db.String(256)) 
    role = db.Column(db.String(20), nullable=False, default='client')
    
    password_reset_required = db.Column(db.Boolean, default=False)
    is_confirmed = db.Column(db.Boolean, nullable=False, default=False) 
    confirmed_on = db.Column(db.DateTime, nullable=True)
    failed_login_attempts = db.Column(db.Integer, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)
    last_failed_login = db.Column(db.DateTime, nullable=True)
    referral_code = db.Column(db.String(10), unique=True, nullable=True)
    referral_points = db.Column(db.Integer, default=0)

    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id'), nullable=True)
    tenant = db.relationship('Tenant', back_populates='users')

    # RELATIONSHIPS
    profiles = db.relationship('Profile', back_populates='user', cascade="all, delete-orphan")
    quote_requests = db.relationship('QuoteRequest', back_populates='user', lazy=True)
    quotes = db.relationship('Quote', back_populates='user', lazy=True, cascade="all, delete-orphan")
    invoices = db.relationship('Invoice', back_populates='user', lazy=True, cascade="all, delete-orphan")

    @property
    def profile(self):
        return self.profiles[0] if self.profiles else None

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        if not self.password_hash: return False
        return check_password_hash(self.password_hash, password)

    def get_confirmation_token(self, salt='email-confirm-salt'):
        s = Serializer(current_app.config['SECRET_KEY'])
        return s.dumps(self.email, salt=salt)

    @staticmethod
    def verify_confirmation_token(token, salt='email-confirm-salt', max_age=3600):
        s = Serializer(current_app.config['SECRET_KEY'])
        try:
            email = s.loads(token, salt=salt, max_age=max_age)
        except:
            return None
        return User.query.filter_by(email=email).first()

class Profile(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Separates "Personal" (None) from "Business" (ID)
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id'), nullable=True) 
    tenant = db.relationship('Tenant', back_populates='clients')

    full_name = db.Column(db.String(100))
    phone_number = db.Column(db.String(20))
    address = db.Column(db.Text)
    profile_image = db.Column(db.String(100), default='avatar_picture_profile_user_icon.png')
    id_number = db.Column(db.String(13))
    date_of_birth = db.Column(db.Date)
    
    service_frequency = db.Column(db.String(50))
    service_fee = db.Column(db.Float)
    notes = db.Column(db.Text)
    strengths = db.Column(db.Text)
    documents = db.Column(JSON)
    has_id_copy = db.Column(db.Boolean, default=False)
    has_drivers_license = db.Column(db.Boolean, default=False)
    has_criminal_check = db.Column(db.Boolean, default=False)
    bank_name = db.Column(db.String(100))
    branch_code = db.Column(db.String(20))
    account_number = db.Column(db.String(50))
    account_type = db.Column(db.String(50))

    user = db.relationship('User', back_populates='profiles', foreign_keys=[user_id])

# --- BUSINESS LOGIC MODELS ---

class QuoteRequest(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    property_type = db.Column(db.String(50), nullable=True) 
    primary_service = db.Column(db.String(100), nullable=True)
    service_frequency = db.Column(db.String(50), nullable=True)
    total_price = db.Column(db.Float, nullable=True)
    service_details = db.Column(db.Text, nullable=True)
    service_category_name = db.Column(db.String(150), nullable=True) 
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    user = db.relationship('User', back_populates='quote_requests')
    
    name = db.Column(db.String(150), nullable=True) 
    email = db.Column(db.String(150), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    address = db.Column(db.String(255), nullable=True) 
    subject = db.Column(db.String(150), nullable=True) 
    description = db.Column(db.Text, nullable=True) 

    request_date = db.Column(db.DateTime, default=datetime.utcnow) 
    status = db.Column(db.String(50), default='Pending') 

    job = db.relationship('Job', back_populates='quote_request', uselist=False)

    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id'), nullable=True)
    tenant = db.relationship('Tenant', back_populates='quote_requests')

class Quote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    quote_number = db.Column(db.String(20), nullable=False)
    quote_date = db.Column(db.Date, nullable=False, default=date.today)
    expiry_date = db.Column(db.Date)
    subtotal = db.Column(db.Float, default=0.0)
    discount_value = db.Column(db.Float, default=0.0)
    discount_type = db.Column(db.String(10), default='R')
    total = db.Column(db.Float, default=0.0)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    status = db.Column(db.String(20), nullable=False, default='Draft')
    acceptance_token = db.Column(db.String(100), unique=True, nullable=True)
    guest_name = db.Column(db.String(100))
    guest_email = db.Column(db.String(100))
    guest_phone = db.Column(db.String(20))
    guest_address = db.Column(db.Text)
    payment_token = db.Column(db.String(100), unique=True, nullable=True)
    deposit_paid = db.Column(db.Boolean, default=False)
    line_items = db.relationship('QuoteLineItem', back_populates='quote', lazy=True, cascade="all, delete-orphan")
    business_address = db.Column(db.String(500), nullable=True)
    registration_number = db.Column(db.String(100), nullable=True)
    terms_and_conditions = db.Column(db.Text, nullable=True)

    user = db.relationship('User', back_populates='quotes')
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id'), nullable=True)
    tenant = db.relationship('Tenant', back_populates='quotes')

    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'quote_number', name='_tenant_quote_uc'),
    )

class QuoteLineItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.Text, nullable=False)
    quantity = db.Column(db.Float, nullable=False, default=1)
    unit_price = db.Column(db.Float, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    quote_id = db.Column(db.Integer, db.ForeignKey('quote.id'), nullable=False)
    service_item_id = db.Column(db.Integer, db.ForeignKey('service_item.id'), nullable=True)
    
    quote = db.relationship('Quote', back_populates='line_items')
    service_item = db.relationship('ServiceItem', back_populates='quote_line_items')

class Invoice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    invoice_number = db.Column(db.String(20), nullable=False)
    invoice_date = db.Column(db.Date, nullable=False, default=date.today)
    due_date = db.Column(db.Date)
    subtotal = db.Column(db.Float, default=0.0)
    total = db.Column(db.Float, default=0.0)
    discount_value = db.Column(db.Float, default=0.0)
    discount_type = db.Column(db.String(10), default='R')
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    status = db.Column(db.String(50), default='Unpaid', nullable=False)
    payment_reference = db.Column(db.String(100), unique=True, nullable=True)
    payment_token = db.Column(db.String(100), unique=True, nullable=True)
    
    client = db.relationship('User', overlaps="invoices,user", foreign_keys=[user_id]) 
    user = db.relationship('User', back_populates='invoices', foreign_keys=[user_id]) 
    line_items = db.relationship('InvoiceLineItem', back_populates='invoice', lazy=True, cascade="all, delete-orphan")
    
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id'), nullable=True)
    tenant = db.relationship('Tenant', back_populates='invoices')

    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'invoice_number', name='_tenant_invoice_uc'),
    )

class InvoiceLineItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.Text, nullable=False)
    quantity = db.Column(db.Float, nullable=False, default=1)
    unit_price = db.Column(db.Float, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    invoice_id = db.Column(db.Integer, db.ForeignKey('invoice.id'), nullable=False)
    invoice = db.relationship('Invoice', back_populates='line_items')

class Job(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    scheduled_date = db.Column(db.Date, nullable=False)
    start_time = db.Column(db.Time, nullable=True)
    end_time = db.Column(db.Time, nullable=True)
    status = db.Column(db.String(50), nullable=False, default='Scheduled')
    notes = db.Column(db.Text, nullable=True)
    quote_request_id = db.Column(db.Integer, db.ForeignKey('quote_request.id'), nullable=True)
    quote_request = db.relationship('QuoteRequest', back_populates='job')
    assigned_staff = db.relationship('User', secondary=job_staff_association, lazy='subquery',
        backref=db.backref('jobs_assigned', lazy=True))
    service_id = db.Column(db.Integer, db.ForeignKey('service_item.id'), nullable=True)
    service = db.relationship('ServiceItem', back_populates='jobs')
    client_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    client = db.relationship('User', foreign_keys=[client_id], backref=db.backref('jobs_as_client', lazy=True))
    
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id'), nullable=True)
    tenant = db.relationship('Tenant', back_populates='jobs')

class BusinessSettings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    business_name = db.Column(db.String(255), default="Nieuwburg Blitz")
    business_address = db.Column(db.String(500), default="24 A 5, Parow Park, Balfour Street, Cape Town, 7500")
    registration_number = db.Column(db.String(100), default="2025/123456/07")
    default_terms = db.Column(db.Text, default="1. All payments are due within 30 days.\n2. ...")
    
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id'), nullable=True, unique=True)
    tenant = db.relationship('Tenant', back_populates='business_settings')
    
    @staticmethod
    def get_settings():
        settings = BusinessSettings.query.first()
        if not settings:
            return BusinessSettings() 
        return settings

class ServiceClause(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)  
    text = db.Column(db.Text, nullable=False)

    service_items = db.relationship(
        'ServiceItem', 
        secondary=service_clauses_association,
        back_populates='linked_clauses'
    )
    
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id'), nullable=True)
    tenant = db.relationship('Tenant', back_populates='service_clauses')

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'text': self.text}

class StaffApplication(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    full_name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), nullable=False)
    phone_number = db.Column(db.String(20), nullable=False)
    id_number = db.Column(db.String(13))
    address = db.Column(db.Text)
    submission_date = db.Column(db.DateTime, default=datetime.utcnow)
    document_filenames = db.Column(JSON, nullable=True)

class ServiceCategory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    calculation_method = db.Column(db.String(50), nullable=False, default='options')
    items = db.relationship('ServiceItem', back_populates='category', lazy=True, cascade="all, delete-orphan")

    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id'), nullable=True)
    tenant = db.relationship('Tenant', back_populates='service_categories')

    __table_args__ = (
        db.UniqueConstraint('tenant_id', 'name', name='_tenant_category_uc'),
    )

class ServiceItem(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False) 
    description = db.Column(db.Text, nullable=True) 
    estimated_time_mins = db.Column(db.Integer, default=0)
    
    pricing_type = db.Column(db.String(20), default='fixed') 
    default_rate = db.Column(db.Float, default=0.0)
    is_material = db.Column(db.Boolean, default=False)
    is_variable_price = db.Column(db.Boolean, default=False)

    category_id = db.Column(db.Integer, db.ForeignKey('service_category.id'), nullable=False)
    
    prices = db.relationship('ServicePrice', back_populates='service_item', lazy=True, cascade="all, delete-orphan")
    category = db.relationship('ServiceCategory', back_populates='items')
    quote_line_items = db.relationship('QuoteLineItem', back_populates='service_item')
    jobs = db.relationship('Job', back_populates='service')
    
    linked_clauses = db.relationship(
        'ServiceClause',
        secondary=service_clauses_association,
        back_populates='service_items'
    )
    
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id'), nullable=True)
    tenant = db.relationship('Tenant', back_populates='service_items')

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'pricing_type': self.pricing_type,
            'default_rate': self.default_rate,
            'estimated_time_mins': self.estimated_time_mins,
            'is_material': self.is_material,
            'is_variable_price': self.is_variable_price,
            'category_id': self.category_id
        }

class ServicePrice(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    frequency = db.Column(db.String(50), nullable=False)
    price = db.Column(db.Float, nullable=False, default=0.0)
    service_item_id = db.Column(db.Integer, db.ForeignKey('service_item.id'), nullable=False)
    service_item = db.relationship('ServiceItem', back_populates='prices')

class Post(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    content = db.Column(db.Text, nullable=False)
    excerpt = db.Column(db.String(300), nullable=True)
    created_date = db.Column(db.DateTime, default=datetime.utcnow)
    author_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    author = db.relationship('User', backref=db.backref('posts', lazy=True))
    is_published = db.Column(db.Boolean, default=False, nullable=False)

    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id'), nullable=True)
    tenant = db.relationship('Tenant', back_populates='posts')

class ActivityLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    activity_type = db.Column(db.String(50), nullable=False)
    description = db.Column(db.Text, nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=True)
    user = db.relationship('User', backref=db.backref('activities', lazy=True))
    
    tenant_id = db.Column(db.Integer, db.ForeignKey('tenant.id'), nullable=True)
    tenant = db.relationship('Tenant', back_populates='activities')

class Settings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(50), unique=True, nullable=False)
    value = db.Column(db.Text, nullable=False)

# --- Helper Functions ---
def get_next_quote_number(tenant_id):
    last_quote = Quote.query.filter_by(tenant_id=tenant_id).order_by(Quote.id.desc()).first()
    if not last_quote or '-' not in last_quote.quote_number:
        return "QU-0001"
    try:
        last_num = int(last_quote.quote_number.split('-')[1])
        new_num = last_num + 1
        return f"QU-{new_num:04d}"
    except (IndexError, ValueError):
        return "QU-0001"

def get_next_invoice_number(tenant_id):
    last_invoice = Invoice.query.filter_by(tenant_id=tenant_id).order_by(Invoice.id.desc()).first()
    if not last_invoice or '-' not in last_invoice.invoice_number:
        return "INV-0001"
    try:
        last_num = int(last_invoice.invoice_number.split('-')[1])
        new_num = last_num + 1
        return f"INV-{new_num:04d}"
    except (IndexError, ValueError):
        return "INV-0001"