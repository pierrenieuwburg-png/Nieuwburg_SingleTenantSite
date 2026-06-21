import os
import uuid
from threading import Thread
from flask import Blueprint, render_template, redirect, url_for, flash, request, session as flask_session, jsonify, current_app
from flask_login import login_user, logout_user, login_required, current_user
from itsdangerous import URLSafeTimedSerializer
from datetime import datetime, timedelta
from werkzeug.utils import secure_filename
from werkzeug.security import generate_password_hash, check_password_hash

from .. import db, mail, oauth
from ..models import User, Profile, Tenant
from ..forms import LoginForm, RegistrationForm, RequestPasswordResetForm, ResetPasswordForm, ChangePasswordForm, UpdateProfileForm
from flask_mail import Message

bp = Blueprint('auth', __name__, url_prefix='/auth')

# --- Helper Functions ---

def generate_confirmation_token(email_or_id):
    """Generates a secure, timed token."""
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    return serializer.dumps(email_or_id, salt=current_app.config.get('SECURITY_PASSWORD_SALT', 'my_precious_salt'))

def confirm_token(token, expiration=3600):
    """Confirms a token and returns the original data if valid."""
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    try:
        data = serializer.loads(
            token,
            salt=current_app.config.get('SECURITY_PASSWORD_SALT', 'my_precious_salt'),
            max_age=expiration
        )
    except:
        return False
    return data

def send_async_email(app, msg):
    """Sends email in a background thread."""
    with app.app_context():
        try:
            mail.send(msg)
        except Exception as e:
            print(f"--- [EMAIL FAILED] ---: {e}")

def send_email_async(msg):
    """Helper to launch thread with current app context."""
    app = current_app._get_current_object()
    thr = Thread(target=send_async_email, args=[app, msg])
    thr.start()


# --- AUTHENTICATION ROUTES ---

@bp.route('/login', methods=['GET', 'POST'])
def login():
    """
    Traffic Cop Login: Authenticates user and directs them to the right dashboard.
    """
    if request.is_json:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        remember = data.get('remember', False)
    else:
        email = request.form.get('email')
        password = request.form.get('password')
        remember = request.form.get('remember_me') == 'y'

    user = User.query.filter_by(email=email).first()

    if user:
        # 1. BRUTE FORCE CHECK: Lockout after 5 attempts
        if user.locked_until and user.locked_until > datetime.utcnow():
            time_remaining = user.locked_until - datetime.utcnow()
            minutes_remaining = (time_remaining.total_seconds() + 59) // 60
            message = f"Account locked. Try again in {int(minutes_remaining)} minutes."
            if request.is_json: return jsonify({'status': 'locked', 'message': message}), 403
            flash(message, 'error')
            return redirect(url_for('main.index'))

        # 2. VALIDATE PASSWORD
        if user.check_password(password):
            # --- THE SECURITY FIX: HARD BLOCK UNVERIFIED USERS (EXCEPT ADMINS) ---
            if not user.is_confirmed and user.role != 'admin':
                msg = "Access Denied: Please verify your email. If you need a new link, simply sign up again!"
                if request.is_json: return jsonify({'status': 'error', 'message': msg}), 403
                flash(msg, 'error')
                return redirect(url_for('main.index'))

            # Reset failed attempts on success
            user.failed_login_attempts = 0
            user.locked_until = None
            db.session.commit()

            login_user(user, remember=remember)

            # --- THE TRAFFIC COP LOGIC ---
            target_url = url_for('main.index')

            if user.role == 'admin':
                target_url = url_for('admin.admin_spa_shell', path='dashboard')
            elif user.role == 'staff':
                target_url = url_for('main.staff_dashboard')
            elif user.role == 'client':
                target_url = request.args.get('next') or '/client/dashboard' 

            if request.is_json: return jsonify({'status': 'ok', 'redirect': target_url})
            return redirect(target_url)
        
        else:
            # 3. FAILED PASSWORD LOGIC
            user.failed_login_attempts += 1
            user.last_failed_login = datetime.utcnow()
            if user.failed_login_attempts >= 5: # Lock after 5 attempts
                user.locked_until = datetime.utcnow() + timedelta(minutes=15)
                user.failed_login_attempts = 0
            db.session.commit()

    # Generic failed message
    message = 'Invalid email or password.'
    if request.is_json: return jsonify({'status': 'error', 'message': message}), 401
    flash(message, 'error')
    return redirect(url_for('main.index'))


@bp.route('/register', methods=['POST'])
def register():
    """
    Public Registration: STRICTLY for Client Users.
    """
    data = request.json
    email = data.get('email')
    password = data.get('password')
    full_name = data.get('full_name')

    if not email or not password or not full_name:
        return jsonify({'status': 'error', 'message': 'Please enter your full name, email, and password.'}), 400

    existing_user = User.query.filter_by(email=email).first()
    
    # --- THE FIX: HANDLE UNCONFIRMED USERS ---
    if existing_user:
        if existing_user.is_confirmed:
            # Fully verified users get blocked from registering again
            return jsonify({'status': 'error', 'message': 'Email already registered. Please log in.'}), 400
        else:
            # User exists but hasn't verified. Update their info and resend email!
            try:
                existing_user.set_password(password)
                if existing_user.profile:
                    existing_user.profile.full_name = full_name
                else:
                    new_profile = Profile(user_id=existing_user.id, full_name=full_name)
                    db.session.add(new_profile)
                db.session.commit()
                
                token = generate_confirmation_token(existing_user.email)
                confirm_url = url_for('auth.confirm_email', token=token, _external=True)
                html = render_template('email/activate.html', confirm_url=confirm_url, user=existing_user)
                msg = Message(
                    subject="[Nieuwburg Blitz] Please Confirm Your Email",
                    sender=current_app.config['MAIL_USERNAME'],
                    recipients=[existing_user.email],
                    html=html
                )
                send_email_async(msg)
                
                return jsonify({
                    'status': 'ok', 
                    'message': f'Account updated! We sent a new confirmation link to {email}.'
                })
            except Exception as e:
                db.session.rollback()
                print(f"Resend Registration Error: {e}")
                return jsonify({'status': 'error', 'message': 'System error. Please try again.'}), 500

    # --- NORMAL REGISTRATION LOGIC FOR BRAND NEW EMAILS ---
    try:
        new_user = User(email=email, role='client', is_confirmed=False)
        new_user.set_password(password)
        db.session.add(new_user)
        db.session.flush() 

        new_profile = Profile(user_id=new_user.id, full_name=full_name)
        db.session.add(new_profile)
        db.session.commit()
        
        try:
            token = generate_confirmation_token(new_user.email)
            confirm_url = url_for('auth.confirm_email', token=token, _external=True)
            html = render_template('email/activate.html', confirm_url=confirm_url, user=new_user)
            
            msg = Message(
                subject="[Nieuwburg Blitz] Please Confirm Your Email",
                sender=current_app.config['MAIL_USERNAME'],
                recipients=[new_user.email],
                html=html
            )
            send_email_async(msg)
        except Exception as e:
            print(f"Email Sending Failed: {e}")
            return jsonify({'status': 'ok', 'message': 'Account created, but we could not send the email. Please contact support.'})

        return jsonify({'status': 'ok', 'message': f'Account created! We sent a confirmation link to {email}.'})

    except Exception as e:
        db.session.rollback()
        print(f"Registration Error: {e}")
        return jsonify({'status': 'error', 'message': 'System error. Please try again.'}), 500


@bp.route('/logout')
@login_required
def logout():
    logout_user()
    flask_session.clear()
    return redirect(url_for('main.index'))


# --- Confirmation & Password Reset ---

@bp.route('/confirm/<token>')
def confirm_email(token):
    email = confirm_token(token) 
    if not email:
        flash('The confirmation link is invalid or has expired.', 'error')
        return redirect(url_for('main.index'))
    
    user = User.query.filter_by(email=email).first_or_404()
    
    if user.is_confirmed:
        # If they click it again, just log them in and go to dashboard
        flash('Account already confirmed. Logging you in...', 'success')
        target_path = 'dashboard' 
    else:
        # First time confirmation
        user.is_confirmed = True
        user.confirmed_on = datetime.utcnow()
        
        # --- SaaS Admin Logic ---
        if user.role == 'admin' and user.tenant_id:
            tenant = Tenant.query.get(user.tenant_id)
            if tenant:
                tenant.is_active = True # Activate the business
                flash(f'Welcome! Your account and business "{tenant.business_name}" are now active.', 'success')
            target_path = 'setup-wizard' 
        else:
            flash('Email confirmed! Welcome to Nieuwburg Blitz.', 'success')
            target_path = 'dashboard'
            
        db.session.commit()
    
    # AUTO-LOGIN
    login_user(user)
    
    # --- REDIRECT LOGIC ---
    if user.role == 'admin' and user.tenant_id:
        # Redirect to the target path determined above (Setup Wizard vs Dashboard)
        return redirect(url_for('admin.admin_spa_shell', path=target_path))
    elif user.role == 'staff':
        return redirect(url_for('main.staff_dashboard'))
    else:
        return redirect(url_for('main.client_dashboard'))


@bp.route('/request-password-reset', methods=['GET', 'POST'])
def request_password_reset():
    # Handle AJAX (Modal) Request
    if request.is_json:
        data = request.get_json()
        email = data.get('email')
        
        user = User.query.filter_by(email=email).first()
        
        if not user:
            # User requested specific error for non-existent emails
            return jsonify({
                'status': 'error', 
                'message': 'No user with this email exists. Please log in with another email or register a new account.'
            }), 404
            
        try:
            token = generate_confirmation_token(user.email)
            reset_url = url_for('auth.reset_password', token=token, _external=True)
            logo_url = url_for('static', filename='img/LogoBlackWithTitle.png', _external=True)
            html = render_template('email/reset_password.html', reset_url=reset_url, logo_url=logo_url)
            msg = Message(subject="[Nieuwburg Blitz] Password Reset",
                          sender=current_app.config['MAIL_USERNAME'], recipients=[user.email], html=html)
            send_email_async(msg)
            
            return jsonify({
                'status': 'ok', 
                'message': f'Instructions sent to {email}. Please check your inbox.'
            })
        except Exception as e:
            print(f"Reset Email Error: {e}")
            return jsonify({'status': 'error', 'message': 'System error sending email.'}), 500

    # Fallback for standard GET request (if someone visits the URL directly)
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    
    form = RequestPasswordResetForm()
    if form.validate_on_submit():
        # ... existing logic for non-modal ...
        pass 
    return render_template('auth/request_password_reset.html', form=form)


@bp.route('/reset-password/<token>', methods=['GET', 'POST'])
def reset_password(token):
    if current_user.is_authenticated:
        return redirect(url_for('main.index'))
    
    email = confirm_token(token, expiration=3600)
    if not email:
        flash('The password reset link is invalid or has expired.', 'error')
        return redirect(url_for('auth.request_password_reset'))
    
    user = User.query.filter_by(email=email).first_or_404()
    form = ResetPasswordForm()
    
    if form.validate_on_submit():
        user.set_password(form.password.data)
        user.password_reset_required = False
        user.is_confirmed = True
        db.session.commit()
        login_user(user)
        flash('Your password has been updated and you are now logged in!', 'success')
        
        if user.role == 'client':
            return redirect('/client/dashboard')
        elif user.role == 'admin':
            return redirect(url_for('admin.admin_spa_shell', path='dashboard'))
        else:
            return redirect(url_for('main.index'))
            
    return render_template('auth/reset_password.html', form=form)


# --- Profile Management ---

@bp.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    # Pass current profile data to form for initial display on GET
    form = UpdateProfileForm(obj=current_user.profile)

    if form.validate_on_submit(): # Runs on POST
        user_profile = current_user.profile

        # Explicitly check request.files for the uploaded image
        uploaded_file = request.files.get(form.profile_image.name) 

        if uploaded_file and uploaded_file.filename != '':
            filename = secure_filename(uploaded_file.filename)
            unique_filename = str(uuid.uuid4()) + "_" + filename
            try:
                upload_path = os.path.join(current_app.config['UPLOAD_FOLDER'], unique_filename)
                uploaded_file.save(upload_path)
                user_profile.profile_image = unique_filename
            except Exception as e:
                print(f"Error saving file: {e}")
                flash('There was an error uploading the image.', 'error')
                return redirect(url_for('auth.profile'))

        # Update other fields
        user_profile.full_name = form.full_name.data
        user_profile.phone_number = form.phone_number.data
        user_profile.address = form.address.data
        
        try:
            db.session.commit()
            flash('Your profile has been updated.', 'success')
        except Exception as e:
            db.session.rollback()
            print(f"Error committing profile update: {e}")
            flash('An error occurred while updating your profile.', 'error')
        
        return redirect(url_for('auth.profile'))
        
    return render_template('client/profile.html', form=form, user_profile=current_user.profile)


@bp.route('/remove-picture', methods=['POST'])
@login_required
def remove_profile_picture():
    current_user.profile.profile_image = 'avatar_picture_profile_user_icon.png'
    db.session.commit()
    flash('Your profile picture has been removed.', 'success')
    return redirect(url_for('auth.profile'))

@bp.route('/delete_account', methods=['POST'])
@login_required
def delete_account():
    user_to_delete = db.session.get(User, current_user.id)
    if user_to_delete:
        db.session.delete(user_to_delete)
        db.session.commit()
    logout_user()
    return jsonify({'status': 'ok', 'message': 'Account deleted successfully.'})


# --- Google OAuth Routes ---

@bp.route('/login/google')
def google_login():
    redirect_uri = url_for('auth.authorize', _external=True)
    return oauth.google.authorize_redirect(redirect_uri)

@bp.route('/authorize')
def authorize():
    token = oauth.google.authorize_access_token()
    user_info = token.get('userinfo')
    if user_info:
        user = User.query.filter_by(email=user_info['email']).first()
        if not user:
            user = User(
                email=user_info['email'],
                role='client', # Default Google logins to Client
                is_confirmed=True,
                confirmed_on=datetime.utcnow()
            )
            db.session.add(user)
            # Ensure profile exists
            if not user.profile:
                 db.session.add(Profile(user=user, full_name=user_info.get('name')))
            else:
                 if not user.profile.full_name:
                     user.profile.full_name=user_info.get('name')
            db.session.commit()
        
        login_user(user)
        flash('You have been successfully logged in with Google.', 'success')
        return redirect('/client/dashboard') # Default to Client Dashboard

    flash('Google login failed. Please try again.', 'error')
    return redirect(url_for('main.index'))


# --- Staff Activation ---

@bp.route('/staff-activate/<token>', methods=['GET', 'POST'])
def staff_activate_token(token):
    try:
        user_id = confirm_token(token, expiration=86400) # 24 hours
    except:
        flash('The activation link is invalid or has expired.', 'error')
        return redirect(url_for('main.index'))

    user = db.session.get(User, user_id)

    if not user or user.role != 'staff':
        flash('Invalid user.', 'error')
        return redirect(url_for('main.index'))
        
    if not user.password_reset_required and user.password_hash:
        flash('This activation link has already been used.', 'warning')
        return redirect(url_for('main.index'))

    form = ChangePasswordForm()
    if form.validate_on_submit():
        user.set_password(form.password.data)
        user.password_reset_required = False
        db.session.commit()
        login_user(user)
        flash('Your password has been set. Welcome to the team!', 'success')
        return redirect(url_for('main.staff_dashboard'))

    return render_template('staff/staff_set_password.html', form=form)

@bp.route('/resend-confirmation', methods=['POST'])
def resend_confirmation():
    data = request.get_json()
    email = data.get('email')
    
    if not email:
        return jsonify({'status': 'error', 'message': 'Email is required.'}), 400
        
    user = User.query.filter_by(email=email).first()
    
    # Security: Don't reveal if user exists, but act like it worked to prevent enumeration
    if not user:
        # Fake success delay to mimic real sending
        import time
        time.sleep(1)
        return jsonify({'status': 'ok', 'message': 'Confirmation email resent!'})
        
    if user.is_confirmed:
        return jsonify({'status': 'info', 'message': 'Account already active. Please log in.'})
        
    try:
        token = generate_confirmation_token(user.email)
        confirm_url = url_for('auth.confirm_email', token=token, _external=True)
        
        html = render_template('email/activate.html', confirm_url=confirm_url, user=user)
        
        msg = Message(
            subject="[Nieuwburg Blitz] Resend: Please Confirm Your Email",
            sender=current_app.config['MAIL_USERNAME'],
            recipients=[user.email],
            html=html
        )
        send_email_async(msg)
        return jsonify({'status': 'ok', 'message': 'Confirmation email resent!'})
    except Exception as e:
        print(f"Resend Failed: {e}")
        return jsonify({'status': 'error', 'message': 'Failed to send email. Please contact support.'}), 500