import os
from datetime import timedelta

# Establish base directory
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    # Core Flask Config
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'you-should-change-this'
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL') or \
        'sqlite:///' + os.path.join(BASE_DIR, 'instance', 'db.sqlite')
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    GOOGLE_MAPS_API_KEY = os.environ.get('GOOGLE_MAPS_API_KEY')

    # Flask-Limiter Config (Updated)
    # This now uses the same filesystem storage as Flask-Session, removing the warning.
    RATELIMIT_STORAGE_URI = "memory://"

    # Flask-Session Config
    SESSION_TYPE = 'filesystem'
    SESSION_PERMANENT = False
    SESSION_USE_SIGNER = True
    SESSION_FILE_DIR = os.path.join(BASE_DIR, '.flask_session')
    PERMANENT_SESSION_LIFETIME = timedelta(minutes=30)

    # Flask-Mail Config
    MAIL_SERVER = os.environ.get('MAIL_SERVER', 'smtp.gmail.com')
    MAIL_PORT = int(os.environ.get('MAIL_PORT', 587))
    MAIL_USE_TLS = os.environ.get('MAIL_USE_TLS', 'true').lower() in ['true', 'on', '1']
    MAIL_USERNAME = os.environ.get('MAIL_USERNAME')
    MAIL_PASSWORD = os.environ.get('MAIL_PASSWORD')
    MAIL_DEFAULT_SENDER = os.environ.get('MAIL_DEFAULT_SENDER', MAIL_USERNAME)

    # File Upload Config
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'nieuwburg', 'static', 'uploads')
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

    # Google OAuth Config
    GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID")
    GOOGLE_CLIENT_SECRET = os.environ.get("GOOGLE_CLIENT_SECRET")

    # --- Quick Book dispatch (Engine A) ---
    # Single source of truth for the dispatch window: used BOTH when
    # dispatch_live_job stamps LeadDispatch.expires_at AND by the timeout sweep's
    # age threshold (arm b). Keep them reading this one value — no drift.
    QUICK_BOOK_DISPATCH_WINDOW_SECONDS = int(os.environ.get('QUICK_BOOK_DISPATCH_WINDOW_SECONDS', 120))
    # Off-switch for the background timeout sweeper (launched from run.py). The
    # sweeper only runs when the server runs; this flag lets ops disable it
    # without a code change.
    DISPATCH_SWEEPER_ENABLED = os.environ.get('DISPATCH_SWEEPER_ENABLED', 'true').lower() in ['true', 'on', '1']
    # How often the sweeper tick runs, in seconds.
    DISPATCH_SWEEPER_INTERVAL_SECONDS = int(os.environ.get('DISPATCH_SWEEPER_INTERVAL_SECONDS', 12))