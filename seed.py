from nieuwburg import create_app, db
from nieuwburg.models import User, Profile, Tenant, BusinessSettings
from flask_migrate import upgrade

app = create_app()

with app.app_context():
    print("Applying migrations...")
    upgrade()                       # builds/updates schema from migration history
    print("Seeding database...")

    # 1. Create the Master Tenant (Your Business HQ)
    hq_tenant = Tenant.query.first()
    if not hq_tenant:
        hq_tenant = Tenant(
            business_name="Nieuwburg HQ",
            subscription_plan="pro",
            is_active=True,
            verification_status='verified'
        )
        db.session.add(hq_tenant)
        db.session.flush()
        print(f"Created HQ Tenant (ID: {hq_tenant.id})")

        # 2. Give the Tenant its Business Settings
        settings = BusinessSettings(
            tenant_id=hq_tenant.id,
            business_name="Nieuwburg HQ",
            is_accepting_leads=True
        )
        db.session.add(settings)
    else:
        print(f"HQ Tenant already exists (ID: {hq_tenant.id})")

    # 3. Create the Master Admin User
    target_email = "admin@example.com"
    default_password = "password123"

    admin_user = User.query.filter_by(email=target_email).first()

    if not admin_user:
        print(f"User {target_email} not found. Generating new admin account...")
        admin_user = User(
            email=target_email,
            role='admin',
            is_confirmed=True,
            tenant_id=hq_tenant.id
        )
        admin_user.set_password(default_password)
        db.session.add(admin_user)
        db.session.flush()  # Get the new user ID
    else:
        admin_user.role = 'admin'
        admin_user.is_confirmed = True
        admin_user.tenant_id = hq_tenant.id
        print(f"Upgraded existing user {target_email} to Admin")

    # Ensure the admin has a profile
    admin_profile = Profile.query.filter_by(user_id=admin_user.id).first()
    if not admin_profile:
        admin_profile = Profile(
            user_id=admin_user.id,
            tenant_id=hq_tenant.id,
            full_name="Master Admin"
        )
        db.session.add(admin_profile)
    else:
        admin_profile.tenant_id = hq_tenant.id

    # Save everything!
    db.session.commit()
    print("--------------------------------------------------")
    print("DATABASE SUCCESSFULLY SEEDED!")
    print(f"Login Email: {target_email}")
    print(f"Password:    {default_password}")
    print("--------------------------------------------------")