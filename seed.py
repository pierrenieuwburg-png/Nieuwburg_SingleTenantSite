from nieuwburg import create_app, db
from nieuwburg.models import User, Profile, Tenant, BusinessSettings, MarketplaceService, MarketplaceServicePrice
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

    # 3. Create the Master Admin (PLATFORM OWNER — a role, NOT a tenant).
    # role='master_admin', tenant_id=None (F1; design note decision #1). The HQ
    # Tenant row is retained for now, but the platform owner no longer belongs to it.
    target_email = "admin@example.com"
    default_password = "password123"

    admin_user = User.query.filter_by(email=target_email).first()

    if not admin_user:
        print(f"User {target_email} not found. Generating new master-admin account...")
        admin_user = User(
            email=target_email,
            role='master_admin',
            is_confirmed=True,
            tenant_id=None
        )
        admin_user.set_password(default_password)
        db.session.add(admin_user)
        db.session.flush()  # Get the new user ID
    else:
        admin_user.role = 'master_admin'
        admin_user.is_confirmed = True
        admin_user.tenant_id = None
        print(f"Set existing user {target_email} as Master Admin (platform owner)")

    # The master admin's profile is personal (no tenant).
    admin_profile = Profile.query.filter_by(user_id=admin_user.id).first()
    if not admin_profile:
        admin_profile = Profile(
            user_id=admin_user.id,
            tenant_id=None,
            full_name="Master Admin"
        )
        db.session.add(admin_profile)
    else:
        admin_profile.tenant_id = None

    # 4. Create a TEST PROVIDER tenant + a tenant-admin user, so the tenant side
    # stays testable after the HQ user became master_admin (design decision (b)).
    provider_email = "provider@example.com"

    provider_tenant = Tenant.query.filter_by(business_name="Test Provider Co").first()
    if not provider_tenant:
        provider_tenant = Tenant(
            business_name="Test Provider Co",
            subscription_plan="pro",
            is_active=True,
            verification_status='verified'
        )
        db.session.add(provider_tenant)
        db.session.flush()
        db.session.add(BusinessSettings(
            tenant_id=provider_tenant.id,
            business_name="Test Provider Co",
            is_accepting_leads=True
        ))
        print(f"Created Test Provider Tenant (ID: {provider_tenant.id})")
    else:
        print(f"Test Provider Tenant already exists (ID: {provider_tenant.id})")

    provider_admin = User.query.filter_by(email=provider_email).first()
    if not provider_admin:
        provider_admin = User(
            email=provider_email,
            role='admin',
            is_confirmed=True,
            tenant_id=provider_tenant.id
        )
        provider_admin.set_password(default_password)
        db.session.add(provider_admin)
        db.session.flush()
    else:
        provider_admin.role = 'admin'
        provider_admin.is_confirmed = True
        provider_admin.tenant_id = provider_tenant.id
        print(f"Set existing user {provider_email} as Test Provider admin")

    provider_profile = Profile.query.filter_by(user_id=provider_admin.id).first()
    if not provider_profile:
        db.session.add(Profile(
            user_id=provider_admin.id,
            tenant_id=provider_tenant.id,
            full_name="Test Provider Admin"
        ))
    else:
        provider_profile.tenant_id = provider_tenant.id

    # 5. Seed a few PLATFORM Quick Book catalogue items (master-created) so the
    # Quick Book payment loop can transact in testing. Names match what the
    # booking modal sends (openBooking('Cleaning') / ('Gardening')).
    def seed_mkt_service(name, **kwargs):
        svc = MarketplaceService.query.filter_by(name=name).first()
        if not svc:
            svc = MarketplaceService(name=name, **kwargs)
            db.session.add(svc)
            db.session.flush()
            print(f"Created MarketplaceService: {name}")
        return svc

    # Gardening = one-off flat price
    seed_mkt_service(
        "Gardening", category="Outdoor", is_active=True, is_quick_bookable=True,
        pricing_mode="flat", flat_price=600.0,
        created_by_tenant_id=None, review_status="approved",
    )

    # Cleaning = frequency-based (rows match the modal's frequency options exactly)
    cleaning = seed_mkt_service(
        "Cleaning", category="Home", is_active=True, is_quick_bookable=True,
        pricing_mode="frequency",
        created_by_tenant_id=None, review_status="approved",
    )
    for freq, price in {"Once-off": 450.0, "Weekly": 350.0,
                        "Bi-Weekly": 380.0, "Monthly": 400.0}.items():
        if not MarketplaceServicePrice.query.filter_by(
            marketplace_service_id=cleaning.id, frequency=freq
        ).first():
            db.session.add(MarketplaceServicePrice(
                marketplace_service_id=cleaning.id, frequency=freq, price=price
            ))

    # Save everything!
    db.session.commit()
    print("--------------------------------------------------")
    print("DATABASE SUCCESSFULLY SEEDED!")
    print(f"Master admin (platform):  {target_email} / {default_password}")
    print(f"Tenant admin (provider):  {provider_email} / {default_password}")
    print("--------------------------------------------------")