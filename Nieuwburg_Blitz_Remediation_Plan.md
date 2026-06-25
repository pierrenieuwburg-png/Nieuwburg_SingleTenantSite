# Nieuwburg Blitz — Sequenced Remediation Plan

**Scope:** Backend correctness, data-layer hardening, and the two marketplace engines (Quick Book / Custom Requests).
**Sequencing principle:** Fix the data layer and the money path before building UI on top of them. Each phase's output is a prerequisite for the next.
**Reference commit:** `Nieuwburg_SingleTenantSite-main` (zip provided 2026-06-24).

> **Context for every ticket below:** the codebase is a working *single-tenant* CRM with marketplace scaffolding layered on top. Several roadmap items depend on foundations that are currently incomplete or broken. Line numbers refer to the files as they exist in the provided zip and will drift as fixes land — treat them as starting anchors, not permanent addresses.

---

## Phase summary

| Phase | Theme | Tickets | Gate it unblocks |
|---|---|---|---|
| **0** | Foundation — de-risk the data layer | P0-1 → P0-4 | Everything concurrency-sensitive |
| **1** | Correctness of money + dispatch | P1-1 → P1-4 | Both engines functioning end-to-end |
| **2** | UI on the safe foundation | P2-1 → P2-3 | Client-facing real-time flows |
| **3** | Polish | P3-1 | — |

**Dependency chain:** P0-3 (lock fix) + P0-2 (enum) gate P1-4 (fallback) and the Phase 2 UIs. P1-1/P1-2 (webhook) are independent and can run in parallel with the rest of Phase 1.

---

## Phase 0 — Foundation (one migration event)

Do P0-1 through P0-3 as a **single Alembic migration**. You are touching the schema for the enum and the lock fix anyway; you do not want two separate painful migrations against live tenant data later.

### P0-1 — Introduce Alembic and baseline the schema

| | |
|---|---|
| **Files** | `nieuwburg/__init__.py:137`, new `migrations/` tree |
| **Severity** | Blocker (prerequisite for all other schema work) |

**Problem.** The app calls `db.create_all()` inside the factory (`__init__.py:137`). There are no migrations, so any schema change today means hand-editing the SQLite file or nuking it. You cannot safely evolve the schema for P0-2/P0-3 without version control over it first.

**Fix.**
1. Add `Flask-Migrate` to `requirements.txt`.
2. Initialize Alembic and autogenerate a baseline migration that captures the **current** schema exactly (no changes yet).
3. Remove `db.create_all()` from the factory once the baseline is applied, so schema state is owned by migrations going forward. The `seed.py` "Nuke and Pave" workflow stays, but runs `flask db upgrade` instead of relying on `create_all()`.

**Done when:** `flask db upgrade` on an empty database reproduces today's schema, and the factory no longer calls `create_all()`.

---

### P0-2 — Replace nullable-`tenant_id`-as-state with an explicit enum

| | |
|---|---|
| **Files** | `nieuwburg/models.py:156-185` (`QuoteRequest`), plus every query that reads "floating" leads |
| **Severity** | High (cross-tenant leak risk; blocks P2-2) |

**Problem.** `QuoteRequest.tenant_id` is nullable (`models.py:178`) and the model literally documents the hack in a comment (`models.py:184-185`): a null tenant means "floating marketplace lead." This overloads a foreign key to encode state. Every new query against `QuoteRequest` must remember the null case or risk leaking one tenant's leads to another. The same nullable-`tenant_id` pattern spans ~13 models, but `QuoteRequest` is the one whose nullability encodes *business state*, so it is the one to fix first.

**Fix.**
1. Add a dedicated column:
   ```python
   # models.py — QuoteRequest
   marketplace_status = db.Column(db.String(20), default='direct', nullable=False)
   # values: 'direct' (tenant-scoped quote), 'floating' (unclaimed marketplace lead),
   #         'claimed' (a tenant has taken it), 'closed' (won/expired/cancelled)
   ```
2. Migration backfills existing rows: `tenant_id IS NULL` → `'floating'`, else `'direct'`.
3. Replace every "floating lead" query that currently filters on `tenant_id IS NULL` with `marketplace_status == 'floating'`. (Audit target list to be produced when this ticket starts — primarily the future P2-2 board and any marketplace fetch in `api.py`.)
4. Keep `tenant_id` for *ownership once claimed*; it stops carrying the "unclaimed" meaning.

**Done when:** no application code branches on `QuoteRequest.tenant_id IS NULL` to mean "floating."

---

### P0-3 — Fix the double-booking lock target

| | |
|---|---|
| **Files** | `nieuwburg/routes/api.py:3194-3247` (`accept_lead`) |
| **Severity** | Critical (latent race, becomes reachable on Postgres) |

**Problem.** The `with_for_update()` at `api.py:3202` locks the single `LeadDispatch` row scoped to the *current* tenant (`id=dispatch_id, tenant_id=current_user.tenant_id`). But two competing Pros accept two *different* dispatch rows for the *same* job — they lock different rows and never block each other. The real guard is the **unlocked** `existing_winner` SELECT at `api.py:3213`, which is a check-then-act race: both requests can read "no winner yet" before either commits, and both set `status='won'` and `job.tenant_id`. On SQLite the global write lock hides this; **on Postgres (P0-4) it becomes reachable.** That is why this fix ships in the same migration event as the database swap.

**Fix.** Lock the contended resource — the **Job** — not the per-tenant dispatch row. Acquire the job lock first, then evaluate the winner check under that lock:
```python
# api.py — accept_lead, replacing the current lock + existing_winner block
# 1. Lock the JOB row (the shared contended resource) for the duration of the txn
job = db.session.query(Job).filter_by(id=dispatch.job_id).with_for_update().first()
if job is None:
    return jsonify({"message": "Job no longer exists."}), 404

# 2. Now the winner check is race-free: no other accept for this job can commit
#    until this transaction releases the job lock.
if job.tenant_id is not None or job.status != 'Quick Book - Searching':
    dispatch.status = 'lost'
    db.session.commit()
    return jsonify({"message": "Another provider claimed this job first!"}), 400
```
Then proceed with the existing "mark won / batch-lose others / set job.tenant_id / emit `pro_found`" logic. The `dispatch` row itself can still be fetched normally (it is per-tenant and uncontended); the lock that matters is on `Job`.

> **Note:** this fix assumes `Job.status` has a defined pre-acceptance value (see P1-3, which formalizes the Quick Book status lifecycle). Land P1-3's status names and this ticket together, or stub the status string and reconcile in P1-3.

**Done when:** two concurrent `accept_lead` calls for the same job under Postgres produce exactly one winner.

---

### P0-4 — Cut SQLite → Postgres

| | |
|---|---|
| **Files** | `config.py:10`, deployment env, `requirements.txt` |
| **Severity** | High (throughput ceiling + exposes P0-3) |

**Problem.** `config.py:10` defaults to SQLite. SQLite serializes all writes via a single database-level lock, so a write-heavy, concurrency-sensitive dispatch system bottlenecks there before the business logic does, and `with_for_update()` provides no row-level protection (it is redundant against the global lock). Postgres gives MVCC with real row-level locking, which both lifts the ceiling and makes P0-3's lock meaningful.

**Fix.**
1. Add `psycopg2-binary` to `requirements.txt`.
2. Provision Postgres; set `DATABASE_URL` (the config already honors it via the `or` fallback at `config.py:10`).
3. Run the Alembic migration (P0-1 baseline + P0-2 enum + P0-3 any schema deltas) against Postgres.
4. Smoke-test the concurrency path from P0-3.

**Done when:** the app runs against Postgres and the P0-3 concurrency test passes.

---

## Phase 1 — Correctness of money + dispatch

### P1-1 — Fix the dead `datetime` import in the dispatch engine

| | |
|---|---|
| **Files** | `nieuwburg/routes/utils.py:3` |
| **Severity** | Critical (Engine A crashes on first dispatch) |

**Problem.** `utils.py:3` imports `from datetime import date, timedelta`, but `dispatch_live_job` calls `datetime.utcnow()` at `utils.py:200`. `datetime` (the class) is never imported in this module, so the broadcast raises `NameError` the instant it fires. Every other route file imports it correctly; this one was missed.

**Fix.** One line:
```python
# utils.py:3 — replace
from datetime import date, timedelta
# with
from datetime import date, datetime, timedelta
```

**Done when:** `dispatch_live_job` runs without `NameError`.

---

### P1-2 — Build a real, idempotent Paystack webhook

| | |
|---|---|
| **Files** | `nieuwburg/routes/main.py:211` (`payment_callback`), new model `ProcessedWebhookEvent`, `__init__.py:135-136` |
| **Severity** | Critical (money correctness) |

**Problem.** The only payment handler is a **`GET` browser-redirect** (`main.py:211`), triggered when the client's browser lands on the callback URL. It is not Paystack's server-to-server webhook, so: (a) if the user closes the tab before redirect, a successful payment may never be processed; (b) refresh/back-forward can re-trigger it; (c) there is no signature verification and no record of which Paystack events have been processed. The current re-verification call to `/transaction/verify` is the only safety net.

**Fix.**
1. Add an idempotency table:
   ```python
   # models.py
   class ProcessedWebhookEvent(db.Model):
       id = db.Column(db.Integer, primary_key=True)
       provider = db.Column(db.String(20), nullable=False, default='paystack')
       event_id = db.Column(db.String(120), nullable=False)   # Paystack event id / reference
       processed_at = db.Column(db.DateTime, default=datetime.utcnow)
       __table_args__ = (db.UniqueConstraint('provider', 'event_id', name='_provider_event_uc'),)
   ```
2. Add a **POST** `/webhooks/paystack` route that verifies the `x-paystack-signature` HMAC against `PAYSTACK_SECRET_KEY`, then on entry inserts the event id and **skips if already present** (the unique constraint plus a caught `IntegrityError` gives you atomic dedup even under concurrent retries).
3. Move the side-effectful state transitions (subscription activation, invoice paid, quote deposit, public booking, and the new Quick Book branch from P1-3) into the webhook handler.
4. Demote `main.py:211` to a **UX redirect only** — it shows the user a "thanks / processing" page and never mutates payment state.
5. This route must stay CSRF-exempt; confirm it is covered. Separately, review the blanket `csrf.exempt(api_bp)` at `__init__.py:135` (see Open Decisions).

**Done when:** replaying the same Paystack event twice produces exactly one state transition and at most one welcome email.

---

### P1-3 — Add the missing Quick Book payment branch and formalize Job status

| | |
|---|---|
| **Files** | `nieuwburg/routes/api.py:3231`, payment handler from P1-2 |
| **Severity** | Critical (Engine A loop dead-ends) |

**Problem.** `accept_lead` sets `job.status = 'Matched - Awaiting Payment'` (`api.py:3231`), but **nothing anywhere transitions it onward** — `'Paid & Scheduled'` exists in zero files. The payment callback's four branches (subscription, invoice, quote deposit, public booking) match none of these matched jobs, so the flow falls through to a homepage redirect (`main.py:396`). A Pro accepts, the client pays, and the job is stranded in `'Matched - Awaiting Payment'` permanently.

**Fix.**
1. Define the Quick Book `Job.status` lifecycle explicitly and use it consistently in `accept_lead`, `dispatch_live_job`, and the webhook:
   `'Quick Book - Searching'` → `'Matched - Awaiting Payment'` → `'Paid & Scheduled'` (plus `'Expired'` from P1-4).
2. In the P1-2 webhook, add a branch that, for a Quick Book payment, **locates the existing matched job by its payment reference** (not creates a new one), transitions it to `'Paid & Scheduled'`, and fires the welcome email behind the idempotency guard.
3. Ensure the Job carries the Paystack reference so the webhook can find it. The `Job` model currently has no payment field — add `payment_reference = db.Column(db.String(120), unique=True, nullable=True)` and set it when the client is redirected to Paystack.

**Done when:** the full Quick Book loop — search → accept → pay → `'Paid & Scheduled'` — completes, and replaying the payment does not duplicate the job.

> **Related cleanup:** the public-booking branch at `main.py:307-383` *creates* a new job on payment and is only *accidentally* idempotent (the `status in ['Pending','New']` check at `main.py:318` gates re-entry but is an unlocked check-then-act). When this logic moves into the P1-2 webhook, the idempotency table makes that guard robust; the redundant status-string gate can then be removed.

---

### P1-4 — Resolve the 60-second dispatch fallback

| | |
|---|---|
| **Files** | `nieuwburg/routes/utils.py:182-216`, scheduler/sweeper (new) |
| **Severity** | Medium-High (UX + supply-density reality) |

**Problem.** `dispatch_live_job` creates 60-second windows (`utils.py:200`) but nothing handles the zero-acceptance case. With early supply density, many Quick Book jobs will time out, and the current behavior is "instant match or silently nothing."

**Fix (recommended path).** When all `LeadDispatch` rows for a job expire with no winner, **auto-convert the job to an Engine B floating request** by creating/marking the associated `QuoteRequest` with `marketplace_status='floating'` (the P0-2 enum makes this trivial) and setting `Job.status='Expired'`. Implement the sweep as a lightweight periodic check (a background thread tick or a scheduled task) plus a guard at accept-time. Decide and document the client-facing message for the transition ("No pro grabbed it instantly — we've posted it for custom quotes").

**Done when:** a Quick Book job with no acceptances within 60s deterministically lands as a floating Engine B lead, exactly once.

---

## Phase 2 — UI on the safe foundation

### P2-1 — Client "Pulse" UI: wire the missing client socket half

| | |
|---|---|
| **Files** | `admin-frontend/src/components/ClientBookingModal.jsx` |
| **Severity** | High (Engine A has no client-side listener today) |

**Problem.** The server emits `pro_found` to room `client_job_{job.id}` (`api.py:3238`), but `ClientBookingModal.jsx` contains **no socket code at all** — nothing ever joins that room, so the ping goes nowhere. The Pro side is wired (`ProviderDispatchModal.jsx:15-17` joins `join_tenant_room` and listens for `incoming_lead`); the client side is greenfield.

**Fix.** On booking submit: hide the submit button, show the pulsating "Searching for pros nearby…" state, open the socket, `join` the `client_job_{job_id}` room, and listen for `pro_found` to redirect to Paystack. Mirror the connection pattern already used in `ProviderDispatchModal.jsx` for consistency.

**Done when:** a client who books a Quick Book job sees the live "pro found" transition without a refresh.

---

### P2-2 — React "Available Leads" board

| | |
|---|---|
| **Files** | new `admin-frontend/src/pages/AvailableLeads.jsx`, `nieuwburg/routes/api.py` (fetch endpoint) |
| **Severity** | Medium |

**Problem / dependency.** This is clean to build *only after* P0-2, because "floating" becomes a queryable enum value (`marketplace_status='floating'`) instead of a nullable foreign key.

**Fix.** Add the API endpoint that returns floating requests with fewer than 5 quotes (count via the `QuoteRequest.quotes` backref), and the `AvailableLeads.jsx` page to display and claim them. Claiming sets `marketplace_status='claimed'` and assigns `tenant_id`.

**Done when:** a Pro can see and claim floating custom requests, and a claimed request leaves every other Pro's board.

---

### P2-3 — Fix the marketplace search endpoint

| | |
|---|---|
| **Files** | `nieuwburg/routes/marketplace.py:9-92` |
| **Severity** | Medium (endpoint 500s on any result) |

**Problem.** Two bugs: (1) the query built at `marketplace.py:22-29` is discarded and rebuilt at `31-34` *without* the `BusinessSettings` join, yet the `location` filter at `:50` references `BusinessSettings`; (2) the output formatter reads `item.member_since`, `item.rating`, `item.review_count` at `:85-87`, none of which exist on `ServiceItem` — so any non-empty result raises `AttributeError`.

**Fix.** Build the query once with all required joins (`Tenant`, `BusinessSettings`, `ServiceCategory`) and the trust filters (`is_active`, `verification_status == 'verified'`). Either add the missing rating/tenure fields to the model or remove them from the payload until the reviews feature exists. Pair this with P2-2 since both touch the marketplace surface.

**Done when:** search returns results (with and without a `location` filter) without error.

---

## Phase 3 — Polish

### P3-1 — Incremental AJAX enhancements

| | |
|---|---|
| **Files** | admin templates + `nieuwburg/routes/api.py` |
| **Severity** | Low (additive) |

Convert remaining full-page-reload form submissions in the Admin Panel to background API calls; build out endpoints for live search, filtering, and instant table updates. Lowest risk, correctly last.

---

## Open decisions (resolve before/at Phase 0)

1. **Blanket CSRF exemption.** `__init__.py:135` exempts the *entire* `api_bp`, which includes state-changing admin endpoints (e.g. `accept_lead`). Decide whether to keep the blanket exemption (acceptable only if those endpoints are protected another way) or scope exemptions to the genuinely token-less routes.
2. **Single-HQ assumption.** `BusinessSettings.get_settings()` at `models.py:311` returns `.first()` regardless of tenant — a single-tenant remnant. Decide whether multi-tenant `BusinessSettings` resolution is in scope now or deferred; it affects how P1-4 and dispatch read provider config.
3. **Socket CORS.** `__init__.py:82` sets `cors_allowed_origins="*"`. Fine for development; tighten before any public launch.
4. **Seed coordinates.** `seed.py` creates `BusinessSettings` without `latitude`/`longitude`, so `haversine_distance` returns 9999 for the HQ provider and dispatch never matches it in testing. Add coordinates to the seed so Engine A is testable end-to-end.

---

## Suggested execution order (flat list)

1. P0-1 Alembic baseline
2. P0-2 `marketplace_status` enum
3. P0-3 lock-target fix
4. P0-4 Postgres cutover *(P0-1→4 ship as one migration event)*
5. P1-1 `datetime` import *(trivial, unblocks Engine A immediately)*
6. P1-2 idempotent webhook *(parallelizable)*
7. P1-3 Quick Book payment branch + Job status lifecycle
8. P1-4 60-second fallback
9. P2-1 client Pulse socket
10. P2-2 Available Leads board
11. P2-3 marketplace search fix
12. P3-1 AJAX polish
