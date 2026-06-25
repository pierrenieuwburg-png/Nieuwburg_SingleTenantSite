# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Nieuwburg Blitz is a single-tenant cleaning-service CRM (South Africa, SAST/ZAR) that is being evolved into a multi-tenant SaaS marketplace. A Flask backend serves traditional Jinja templates for the public marketing site and embeds a single React/Vite SPA that powers three portals (admin, staff, client). It also has a real-time "marketplace" that broadcasts Quick Book leads to nearby providers over WebSockets.

**Read `Nieuwburg_Blitz_Remediation_Plan.md` before starting any backend task.** It is the sequenced source of truth for what is being changed and in what order. Much of the current code is single-tenant CRM with marketplace scaffolding layered on top; several "current shape" patterns described below are landmines actively being removed, not patterns to extend. Where this file says **[BEING CHANGED — see <ticket>]**, do not propagate the existing pattern into new code.

## Commands

All Python commands require the virtualenv active (`.venv`). `FLASK_APP=run.py` is set via `.flaskenv`.

```bash
# Run backend (uses socketio.run, not app.run — required for WebSockets)
python run.py                      # serves http://0.0.0.0:5000

# Frontend (run from nieuwburg/admin-frontend/)
npm run dev                        # Vite dev server on :5173, proxies /client/api, /auth, /static to :5000
npm run build                      # builds into ../static/admin-assets (index.js / index.css)
npm run lint                       # eslint, max-warnings 0

# Build frontend then run backend in one step (from repo root)
make                               # == make build-run

# Database (Flask-Migrate / Alembic)
flask db migrate -m "message"      # autogenerate a migration — ALWAYS open and review it before upgrading
flask db upgrade                   # apply migrations
flask db current                   # show the currently-applied revision
python seed.py                     # runs `flask db upgrade` + seeds HQ tenant and admin@example.com / password123
```

There is **no test suite** in this repo. Verify changes by running the affected path manually and, for migrations, by reading the generated migration file before `upgrade`.

## Working agreement

- **Plan before editing on any multi-file ticket.** Propose the file list and approach, get sign-off, then implement. The remediation plan's tickets (P0-1 … P3-1) are the unit of work.
- **One ticket at a time.** Do not bundle unrelated fixes into a ticket's diff; it makes review and rollback harder.
- **Migrations are reviewed, never blind.** After `flask db migrate`, open the file in `migrations/versions/` and confirm it does what's intended (especially data backfills, which autogenerate does NOT write) before `flask db upgrade`.
- **Keep diffs reviewable.** The human reviews every change in VS Code before commit.

## Architecture

### App factory & extensions
`nieuwburg/__init__.py` is the app factory (`create_app`). All Flask extensions are instantiated at module scope and bound inside the factory: `db` (SQLAlchemy), `migrate` (Flask-Migrate, `render_as_batch=True`), `login_manager`, `mail`, `csrf`, `oauth` (Authlib Google OIDC), `limiter` (Flask-Limiter, default 200/day 50/hour), `Session` (filesystem), and `socketio` (Flask-SocketIO, `cors_allowed_origins="*"`). Config comes from `config.py` (`Config` class), driven by env vars loaded from `.env`.

- `socketio` uses `cors_allowed_origins="*"` — fine for dev, **must be tightened before public launch.**
- Schema is owned by migrations; there is **no `create_all()`** in the factory. Do not reintroduce it.

### Blueprints (registered in the factory)
- `main` (no prefix) — public marketing pages, payment callback, quote-request intake, staff SPA shell.
- `auth` (`/auth`) — login, registration, email confirmation, Google OAuth.
- `admin` (`/admin`) — server-side admin actions; defines the `admin_required` decorator reused across blueprints.
- `api` (`/api`) — the large (~3000 line) JSON API for the admin/staff SPA. **CSRF-exempt (blanket `csrf.exempt(api_bp)`).**
- `client` (`/client`) — client-portal JSON API under `/client/api/*` plus the client SPA shell.
- `marketplace` — real-time lead dispatch endpoints. **CSRF-exempt.**

When adding API routes, mirror the existing pattern: `@login_required` + an explicit role check (`current_user.role != 'admin'`) returning a 403 JSON body, or the `admin_required` decorator.

> **[BEING CHANGED — Open Decision in remediation plan]** The blanket `csrf.exempt(api_bp)` exempts every state-changing admin endpoint (e.g. `accept_lead`). Whether to scope this down is an open decision; don't widen the exemption.

### Multi-tenancy (critical)
Nearly every business model carries a **nullable** `tenant_id` FK to `Tenant`. **All queries must be scoped to `current_user.tenant_id`** — see `get_next_quote_number`/`get_next_invoice_number` in `routes/utils.py` for the expected pattern. Several constraints are unique *per tenant* (`UniqueConstraint('tenant_id', ...)`), so sequences restart per tenant. A `User` may have multiple `Profile` rows — one personal (`tenant_id=None`) and one per tenant; `User.profile` returns the first. Forgetting tenant scoping leaks data across businesses.

> **[BEING CHANGED — P0-2]** `QuoteRequest.tenant_id IS NULL` is currently overloaded to mean "floating marketplace lead." This is being replaced by an explicit `marketplace_status` column (`direct` / `floating` / `claimed` / `closed`). **Do not write new code that treats a null `tenant_id` as "floating."** Once P0-2 lands, query `marketplace_status == 'floating'` instead. `tenant_id` retains only its ownership meaning.

`BusinessSettings.get_settings()` returns `.first()` regardless of tenant — a single-tenant remnant. **[Open Decision]** Don't rely on it for tenant-correct config in new multi-tenant code.

### Single SPA, three portals
One React bundle (`admin-frontend/src/main.jsx`) mounts differently based on which DOM root the server-rendered template exposes:
- `#admin-app-root` → basename `/admin` (or `/staff-app` if the URL starts with `/staff-app`).
- `#root` → client portal, basename `/`.

`App.jsx` holds all routes for every portal. The build emits fixed filenames (`index.js`, `index.css`) so Jinja templates can reference them statically (see `vite.config.js`). After changing frontend code you must `npm run build` for Flask to serve the update (or use the Vite dev server with its proxy).

### Real-time marketplace dispatch (Engine A — Quick Book)
`dispatch_live_job` in `routes/utils.py`: when a client requests a Quick Book job, it finds `BusinessSettings` rows with `is_accepting_leads=True`, computes `haversine_distance` from the job pin to each provider HQ, filters by `service_radius_km`, creates a `LeadDispatch` row with a 60-second `expires_at`, and `socketio.emit('incoming_lead', ...)` to `room=f"tenant_{tenant_id}"`. The frontend `ProviderDispatchModal` consumes these. `LeadDispatch` has a unique `(job_id, tenant_id)` constraint.

The accept path is `accept_lead` in `routes/api.py`: the first provider to accept wins the job; others are marked `lost`; the client is pinged via `socketio.emit('pro_found', ...)` to `room=f"client_job_{job.id}"`.

> **Known-broken paths in this engine (do not assume they work):**
> - **[P1-1]** `routes/utils.py` imports only `date, timedelta` but `dispatch_live_job` calls `datetime.utcnow()` — raises `NameError` on first dispatch.
> - **[P0-3]** `accept_lead`'s `with_for_update()` locks the per-tenant `LeadDispatch` row, not the contended `Job`; the winner check is an unlocked check-then-act race (latent on SQLite, reachable on Postgres).
> - **[P1-3]** `accept_lead` sets `Job.status='Matched - Awaiting Payment'`, but nothing transitions it onward — `'Paid & Scheduled'` exists nowhere and the payment callback has no Quick Book branch. The loop dead-ends.
> - **[P2-1]** `ClientBookingModal.jsx` has no socket code, so nothing joins `client_job_{job_id}`; the `pro_found` ping currently goes nowhere.

### Payments (Paystack)
`payment_callback` in `routes/main.py` is a **GET browser-redirect**, not a signed server-to-server webhook. It re-verifies each reference against Paystack's `/transaction/verify`. Branches: subscription, invoice, quote deposit, public booking.

> **[BEING CHANGED — P1-2]** This is not idempotent (no processed-events record, no signature verification; the public-booking branch is only *accidentally* idempotent via an unlocked status check). A signed POST `/webhooks/paystack` with a `ProcessedWebhookEvent` dedup table is the target; the GET callback becomes UX-only. Don't add new payment side effects to the GET callback.

### Models of note
`nieuwburg/models.py` is the single source of truth. Domain flow: `QuoteRequest` (lead/intake, may be a floating marketplace lead) → `Quote` (formal, with `QuoteLineItem`s, acceptance/payment tokens, deposits) → `Job` (scheduled, `JobTask` checklist + `JobPhoto` before/after) → `Invoice` (`InvoiceLineItem`s). `ServiceCategory` has a `calculation_method` (`property_size`/`hourly`/`a_la_carte`/`lead_gen`) driving pricing; `ServiceItem` + `ServicePrice` define the catalog. `BusinessSettings` is per-tenant (deposit %, geolocation, service radius, online/offline toggle). Note: `Job` currently has **no payment-reference column** — P1-3 adds one so the webhook can locate a matched job.

### Marketplace search
`routes/marketplace.py` `/api/marketplace/search` is **[BEING CHANGED — P2-3]**: it currently rebuilds its query and drops the `BusinessSettings` join the `location` filter needs, and formats nonexistent `ServiceItem` fields (`member_since`, `rating`, `review_count`) — it 500s on any non-empty result. Don't treat it as a working reference until P2-3 lands.

### Background email & PDF
Email sends are fired on a background `Thread` (`send_async_email` / `send_email_with_attachment` in `routes/utils.py`). PDFs (quotes/invoices) are rendered from Jinja templates via `xhtml2pdf`/`pisa` in `render_template_to_pdf`.

### Conventions
- Times are stored in UTC; the `to_sast` Jinja filter converts to `Africa/Johannesburg` for display. `nl2br` is defined in multiple modules — reuse, don't reinvent.
- `migrate.init_app(..., render_as_batch=True)` — required for SQLite ALTER support; keep it when editing the factory.
- Schema changes go through Flask-Migrate migrations (`migrations/versions/`); there is no `create_all()` — `seed.py` runs `upgrade()` first.
- Uploaded files land in `nieuwburg/static/uploads`; allowed extensions are png/jpg/jpeg/gif.
- `requirements.txt` is UTF-16 encoded — edit it in an editor that preserves the encoding; don't append from a shell.