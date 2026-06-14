from nieuwburg import create_app, db
from nieuwburg.models import User, Profile, Tenant, BusinessSettings

app = create_app()

if __name__ == '__main__':
    with app.app_context():
        # Create the database tables if they don't exist
        db.create_all()

        # 1. Ensure Default Tenant Exists
        default_tenant = Tenant.query.first()
        if not default_tenant:
            print("Creating default tenant...")
            default_tenant = Tenant(
                business_name="Nieuwburg Blitz HQ",
                subscription_plan="pro",
                is_active=True,
                verification_status='verified'
            )
            db.session.add(default_tenant)
            db.session.flush() # Flush to get the ID
            
            # Create Default Settings for this Tenant
            settings = BusinessSettings(
                tenant_id=default_tenant.id,
                business_name="Nieuwburg Blitz HQ"
            )
            db.session.add(settings)
            db.session.commit()

        # 2. Ensure Admin User Exists (and is linked to Tenant)
        if not User.query.filter_by(email='admin@example.com').first():
            print("Creating default admin user...")
            admin_user = User(
                email='admin@example.com',
                role='admin',
                is_confirmed=True,
                tenant_id=default_tenant.id # <--- THE FIX: Link to Tenant
            )
            admin_user.set_password('password')
            db.session.add(admin_user)
            db.session.flush()

            # 3. Create Admin Profile (Linked to Tenant)
            admin_profile = Profile(
                user_id=admin_user.id, 
                full_name='System Admin',
                tenant_id=default_tenant.id # <--- THE FIX: Link Profile too
            )
            db.session.add(admin_profile)
            
            db.session.commit()
            print(f"Default admin user created: admin@example.com (Tenant ID: {default_tenant.id})")

    app.run(debug=True)