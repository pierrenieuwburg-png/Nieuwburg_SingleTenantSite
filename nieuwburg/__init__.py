import os
from dotenv import load_dotenv
load_dotenv()  # must run BEFORE config is imported (Config reads os.environ at import time)
from flask_socketio import SocketIO
from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_login import LoginManager
from flask_mail import Mail
from flask_wtf.csrf import CSRFProtect
from flask_session import Session
from authlib.integrations.flask_client import OAuth
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from config import Config
from datetime import datetime
import pytz
from markupsafe import escape, Markup

# Initialize extensions
db = SQLAlchemy()
migrate = Migrate()
login_manager = LoginManager()
mail = Mail()
csrf = CSRFProtect()
oauth = OAuth()
limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# --- ADDED: Initialize SocketIO globally here ---
socketio = SocketIO()

# --- ADDED: Timezone conversion filter ---
def to_sast(utc_dt):
    """Converts a UTC datetime object to SAST (Africa/Johannesburg)."""
    if utc_dt is None:
        return None
    try:
        utc_timezone = pytz.timezone('UTC')
        sast_timezone = pytz.timezone('Africa/Johannesburg')
        # Ensure the datetime object is timezone-aware (assume UTC if naive)
        if utc_dt.tzinfo is None:
            aware_utc_dt = utc_timezone.localize(utc_dt)
        else:
            aware_utc_dt = utc_dt.astimezone(utc_timezone)
        return aware_utc_dt.astimezone(sast_timezone)
    except Exception as e:
        print(f"Error converting timezone: {e}")
        return utc_dt

def nl2br(value):
    """Converts newlines in text to HTML <br> tags."""
    if value is None:
        return ''
    escaped_value = escape(str(value)) 
    result = escaped_value.replace('\r\n', '<br>\n').replace('\n', '<br>\n')
    return Markup(result)

def create_app(config_class=Config):
    """Create and configure an instance of the Flask application."""
    app = Flask(__name__, instance_relative_config=True)
    app.config.from_object(config_class)

    # Ensure the instance folder exists
    try:
        os.makedirs(app.instance_path)
    except OSError:
        pass

    # Initialize Flask extensions here
    db.init_app(app)
    migrate.init_app(app, db, render_as_batch=True)
    login_manager.init_app(app)
    login_manager.login_view = 'auth.login' # Blueprint name 'auth', route 'login'
    mail.init_app(app)
    csrf.init_app(app)
    oauth.init_app(app)
    limiter.init_app(app)
    Session(app)

    # --- ADDED: Bind SocketIO to the app here ---
    socketio.init_app(app, cors_allowed_origins="*")

    # User loader function for Flask-Login
    from .models import User
    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    # --- Context Processors ---
    @app.context_processor
    def inject_now():
        """Injects the current UTC time into all templates."""
        return {'now': datetime.utcnow()}
    
    @app.context_processor
    def inject_maps_key():
        """Injects the Google Maps API key into all templates."""
        return {'google_maps_api_key': app.config['GOOGLE_MAPS_API_KEY']}

    @app.context_processor
    def inject_auth_forms():
        """Injects login and registration forms into all templates."""
        from .forms import LoginForm, RegistrationForm
        login_form = LoginForm()
        register_form = RegistrationForm()
        return dict(login_form=login_form, register_form=register_form)

    app.jinja_env.filters['to_sast'] = to_sast
    app.jinja_env.filters['nl2br'] = nl2br

    oauth.register(
        name='google',
        client_id=app.config['GOOGLE_CLIENT_ID'],
        client_secret=app.config['GOOGLE_CLIENT_SECRET'],
        server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
        client_kwargs={'scope': 'openid email profile'}
    )

    with app.app_context():
        # Import and register Blueprints
        from .routes.main import bp as main_bp
        from .routes.auth import bp as auth_bp
        from .routes.admin import bp as admin_bp
        from .routes.api import bp as api_bp
        from .routes.client import bp as client_bp
        from .routes.marketplace import bp as market_bp
        from .routes.master import bp as master_bp
        app.register_blueprint(main_bp)
        app.register_blueprint(auth_bp, url_prefix='/auth')
        app.register_blueprint(admin_bp, url_prefix='/admin')
        app.register_blueprint(api_bp)
        app.register_blueprint(client_bp)
        app.register_blueprint(market_bp)
        # Master-admin (platform) area (F3). Deliberately NOT csrf-exempt — the
        # React master UI sends X-CSRFToken on mutations (D3); don't widen the
        # blanket api_bp/market_bp exemption.
        app.register_blueprint(master_bp, url_prefix='/master-admin')

        csrf.exempt(api_bp)
        csrf.exempt(market_bp)
        
    @app.after_request
    def add_security_headers(response):
        response.headers['X-Content-Type-Options'] = 'nosniff'
        # Note: Flask/Werkzeug manage Cache-Control well, especially in non-debug.
        # Avoid setting 'Expires' manually unless you have a very specific legacy need.
        # The 'no-store' during debug is expected and okay for development.
        return response
    
    return app