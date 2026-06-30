"""F1: HQ user admin@example.com -> master_admin, tenant_id NULL

Revision ID: 3b39abc8521c
Revises: c5cdba2db8d3
Create Date: 2026-06-30 19:59:03.451702

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '3b39abc8521c'
down_revision = 'c5cdba2db8d3'
branch_labels = None
depends_on = None

# F1 (master-admin role): the live DB seeded the platform owner as a tenant admin
# (role='admin', tenant_id=<HQ tenant>). The platform owner is a role, NOT a tenant
# — flip the seeded HQ user to role='master_admin', tenant_id=NULL. Data-only; no
# schema change (role is a free-text column, tenant_id already nullable). The user
# is targeted by the seed email. "user" is quoted (reserved word on Postgres).
HQ_EMAIL = "admin@example.com"


def upgrade():
    op.get_bind().execute(
        sa.text(
            'UPDATE "user" SET role = :new_role, tenant_id = NULL '
            'WHERE email = :email'
        ),
        {"new_role": "master_admin", "email": HQ_EMAIL},
    )


def downgrade():
    # Reverse: restore the HQ user to a tenant admin on the HQ tenant
    # ('Nieuwburg HQ', lowest id if duplicated). If no HQ tenant exists, leave
    # tenant_id NULL but restore the 'admin' role.
    bind = op.get_bind()
    hq_tenant_id = bind.execute(
        sa.text(
            "SELECT id FROM tenant WHERE business_name = :name ORDER BY id LIMIT 1"
        ),
        {"name": "Nieuwburg HQ"},
    ).scalar()
    bind.execute(
        sa.text(
            'UPDATE "user" SET role = :old_role, tenant_id = :tid WHERE email = :email'
        ),
        {"old_role": "admin", "tid": hq_tenant_id, "email": HQ_EMAIL},
    )
