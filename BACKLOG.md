# Backlog

Deferred issues recorded during other work. Not yet ticketed into the phased
remediation plan unless noted. Line numbers are anchors and will drift as code
changes — treat them as starting points, not permanent addresses.

---

## 1. [Security] Strip-tenant-filter on QuoteRequest fetch — cross-tenant read — ✅ RESOLVED (commit `0ee70e7`)

**Fixed:** all affected by-id fetches now scope by
`tenant_id=current_user.tenant_id` and return 404 on miss. The audit found a
**THIRD** site the original note missed — `api_delete_quote` with `type=quote`
performed a **destructive cross-tenant `Quote` deletion** (plus its line items),
not just the two `QuoteRequest` reads/deletes — so the fix covered **all three
sites**, closing the whole class:
- `get_quote_detail` (GET `/admin/quotes/<id>`) — cross-tenant READ.
- `api_delete_quote` `type=request` — cross-tenant DELETE of a `QuoteRequest`.
- `api_delete_quote` `type=quote` — cross-tenant DELETE of a `Quote` (+ line items). *(the missed third site)*

The deliberately cross-tenant marketplace paths (`get_available_leads` floating
board, `claim_available_lead`) were left untouched. Verified against Postgres
(16/16: own read/delete work; cross-tenant read/delete → 404 with the target row
intact; floating board + claim unaffected). Original report below for reference.

- **Location:** `nieuwburg/routes/api.py:262` and `nieuwburg/routes/api.py:645`
  (both marked `# DIAGNOSTIC\MVP MODE: Strip Tenant Filter`).
- **Problem:** `QuoteRequest` is fetched by id with **no** `tenant_id` scoping:
  `QuoteRequest.query.filter_by(id=quote_id).first()` (and the `item_id` variant
  at :645). The surrounding tenant-aware paths filter by
  `tenant_id=current_user.tenant_id`; these two deliberately do not.
- **Risk:** Cross-tenant data leak. An authenticated user of tenant A can read
  tenant B's lead simply by guessing/iterating the numeric id. Sequential
  integer PKs make enumeration trivial.
- **Phase / priority:** **High, own ticket, must land before any public launch.**
  Independent of P0-2; fix by re-adding `tenant_id=current_user.tenant_id` to
  both queries (and returning 404 on mismatch).

---

## 2. [P2-3 known] marketplace `/search` endpoint 500s on any result — ✅ RESOLVED (commit `02d6167`)

**Fixed:** query is now built once with all joins; `BusinessSettings` is
outer-joined (services on a settings-less tenant still surface, with the null
address guarded in the payload); `member_since`/`rating`/`review_count` dropped.
Verified end-to-end against Postgres — searches with/without a `location` filter
and a no-settings tenant all return 200, and the trust filters
(`is_active`, `verification_status == 'verified'`) exclude unverified/inactive
tenants. Original report below for reference.

- **Location:** `nieuwburg/routes/marketplace.py` (`search_marketplace`, ~lines 9–92).
- **Problem:** Two defects:
  1. The query is built with the `BusinessSettings` join at lines 22–29, then
     **discarded and rebuilt** at lines 31–34 *without* that join — yet the
     `location` filter at line 50 references `BusinessSettings.business_address`.
  2. The output formatter reads `item.member_since`, `item.rating`, and
     `item.review_count` (lines 85–87), none of which exist on `ServiceItem`.
- **Risk:** Any non-empty search result raises `AttributeError` (and the
  location filter raises on the un-joined query) → endpoint 500s. The public
  marketplace search is effectively unusable.
- **Phase / priority:** **Phase 2 — this is the already-scoped P2-3 ticket.**
  Build the query once with all required joins (`Tenant`, `BusinessSettings`,
  `ServiceCategory`); either add the rating/tenure fields to the model or drop
  them from the payload until the reviews feature exists.

---

## 3. [P2-2 note] Admin dashboard counts hide floating leads

- **Location:** `nieuwburg/routes/api.py:167` and `nieuwburg/routes/api.py:1914`.
- **Problem:** These admin dashboard queries filter `QuoteRequest` by
  `tenant_id=current_user.tenant_id`. After P0-2, floating marketplace leads
  carry `tenant_id IS NULL` (`marketplace_status='floating'`), so they will
  never match these tenant-scoped counts and won't surface on the dashboard.
- **Risk:** Not a leak — the opposite: unclaimed leads are invisible to admins
  via these counts. Acceptable today (tenant dashboards intentionally show only
  owned rows), but a correctness trap for whoever builds the leads UI.
- **Phase / priority:** **Phase 2 — note for P2-2.** The "Available Leads" board
  must query `marketplace_status='floating'` (not a `tenant_id` filter) to list
  unclaimed leads. Do not "fix" the dashboard counts to include floating rows.

---

## 4. [Tooling] venv `flask.exe` launcher points at a stale sibling venv

- **Location:** `.venv/Scripts/flask.exe` in `nieuwburg-mvp`.
- **Problem:** The `flask.exe` entry-point launcher has an embedded python path
  pointing at a different, sibling venv (`...\Cleaning Division\Nieuwburg\.venv`),
  which lacks this project's installed packages (e.g. `psycopg2`). Running
  `flask db upgrade` directly fails with `ModuleNotFoundError`/`No such command
  'db'` because the app import blows up under the wrong interpreter.
- **Workaround:** Invoke Flask through the correct interpreter:
  `.venv\Scripts\python.exe -m flask <cmd>` (e.g. `python -m flask db upgrade`).
- **Phase / priority:** **Low.** Recreate the venv in-place so the launcher
  shebangs resolve to this project's python; until then, always use
  `python -m flask`.

---

## 5. [Tech debt] `datetime.utcnow()` is deprecated on Python 3.12+

- **Location:** Multiple files — `nieuwburg/routes/utils.py` (`dispatch_live_job`,
  ~line 200) and likely others (`models.py` column defaults, `api.py`, `main.py`).
  Grep for `utcnow()` to find all call sites before tackling.
- **Problem:** `datetime.utcnow()` is deprecated as of Python 3.12 and emits a
  `DeprecationWarning` on this project's Python 3.14. It still works — this is a
  warning, not an error — but it is flagged for eventual removal from Python.
- **Risk / caution:** The modern replacement `datetime.now(timezone.utc)` returns
  a timezone-**aware** datetime, whereas this codebase currently stores **naive**
  UTC datetimes. A piecemeal swap will cause `TypeError: can't compare
  offset-naive and offset-aware datetimes` wherever a converted value is compared
  against a still-naive one (e.g. `LeadDispatch.expires_at` checks). This makes a
  partial change *worse* than the current harmless warning.
- **Phase / priority:** **Low.** Must be done deliberately across the whole
  codebase at once, with a consistent decision (go fully timezone-aware
  everywhere, or strip tzinfo to stay naive everywhere) — not file-by-file. Worth
  doing before a future Python upgrade removes `utcnow()` entirely.

---

## 6. [P1-2 follow-up] Alerting for unroutable / failed Paystack charges

- **Location:** `nieuwburg/routes/main.py` — `paystack_webhook` and
  `_process_paystack_payment` (P1-2).
- **Problem:** The webhook's safety net for money it can't process is a
  `current_app.logger` line, by design:
  - **WARNING** — a verified `charge.success` whose metadata matches no handler
    (unrecognised shape). Row kept, returns 200, no retry.
  - **ERROR** — re-verify did not confirm success; DB processing failed after
    the dedup record; or a post-commit side effect (welcome email) failed. Row
    kept, returns 200, no retry — a human must reconcile.
- **Risk:** These log lines are the *only* signal that a real payment was
  received but not fully handled. If nothing watches the logs, a stranded
  payment is silently invisible until a customer complains. The idempotency
  design deliberately favours "no duplicate" over "auto-retry," which makes
  human-visible alerting the required backstop, not a nice-to-have.
- **Fix:** Route these WARNING/ERROR lines to an actual alert channel (email to
  ops, Slack/webhook, Sentry, or a "needs reconciliation" admin queue). At
  minimum, ensure prod logging captures WARNING+ from this module durably.
- **Phase / priority:** **Medium — required before taking real payment volume.**
  Not a code-correctness bug; an operational gap that P1-2's design depends on.

---

## 7. [P1-3 prerequisite] Master-admin Quick Book pricing catalog + frequency capture (= feature **F2**)

> **⚑ Design note:** scoping #7 surfaced the wider master-admin/platform model.
> See `Nieuwburg_Blitz_MasterAdmin_and_Pricing_Design.md` for the locked decisions
> (F1–F6, the unified service-item model, the 4A sequencing). Key corrections to
> the original text below: pricing/bookability live at the **service-item** level,
> **not** per category (design decisions #3/#7); pricing is master-admin-set via a
> proper `master_admin` role, **not** "HQ = a tenant"; "one-off-with-inputs" is
> **deferred** to its own ticket (first version = frequency-based + one-off-flat).
>
> **Increment breakdown (4A):** (1) **F1** minimal master-admin role →
> (2) pricing data model (unified item model + Quick Book price rows +
> `resolve_price_for_job` + `Job` frequency/item capture + seed) →
> (3) **F3** master-admin item-management UI → then F5/F4/F6. Each its own
> scoped increment.

- **Location:** new master-admin/HQ feature; consumed by the Quick Book
  payment-init seam in `nieuwburg/routes/client.py` (P1-3) and by
  `create_booking` + the `Job` model.
- **Problem / context:** P1-3 adds the Quick Book payment loop but deliberately
  does **not** decide pricing. The payment-init endpoint resolves the price from
  the matched `Job` via a single "resolve price for this job" seam; while no
  pricing/frequency data lives on the Job, it returns "no usable price" and the
  endpoint **refuses** (no Paystack transaction, no `payment_reference`, no
  charge). That is correct and safe, but means Quick Book cannot take a real
  payment until this catalog exists and the Job carries the needed inputs.
- **Two confirmed gaps this feature must close:**
  1. **No pricing catalog.** There is no master-admin-controlled source of
     prices. Pricing is **service-dependent**, not uniform: some services are
     frequency-based (cleaning, landscaping, babysitting), some are one-off flat
     (toilet install), some are one-off needing client input (tiling needs
     area). The catalog must therefore record, **per service category**:
     - whether the service is **frequency-based / one-off-flat / one-off-with-inputs**,
     - the price(s) for each applicable mode,
     - whether the service is **Quick-Bookable vs quote-only**,
     - and feed both Quick Book charges **and** public price display.
  2. **Frequency captured in UI but dropped on the floor.** `ClientBookingModal.jsx`
     has a Frequency selector (Once-off / Weekly / …) and POSTs `frequency` in
     the `createBooking` body, but `create_booking` (`client.py`) never reads it
     and the `Job` model has no frequency column — so the choice is silently
     discarded. (Frequency columns exist only on Quote/QuoteRequest models and
     `ServicePrice`, none attached to `Job`.) This feature must **capture the
     existing front-end frequency selection onto the Job** so the price seam can
     resolve a real amount.
- **Risk:** Until this lands, every Quick Book payment-init refuses — the loop is
  code-complete but cannot transact. No risk of a wrong charge (refusal is the
  safe default); the gap is purely "can't yet take real money."
- **Phase / priority:** **Required before Quick Book real payments** — not low.
  Sequenced **after** the payment plumbing (P1-2/P1-3), before any Quick Book
  launch.

---

## Guiding identity pattern (applies to #8 and #9)

**Deferred-account model — adopt the existing public-booking shadow-account
pattern as the standard for ALL Quick Book entry points.** Decided 2026-06-27.

- **No signup wall before payment.** Booking details create a person-record
  immediately (the `get_or_create_guest_client` "shadow account" pattern already
  used by `/api/public/book`). Payment is never gated behind login.
- **Password is an optional, post-payment self-service upgrade.** A "set your
  password" email goes out *after* payment; access to a dashboard is the reward,
  not a prerequisite.
- **Logged-in users get faster, pre-filled checkout** — a convenience, not a
  requirement. Same underlying flow either way.
- **Every booking becomes a provider-saveable client record** regardless of
  password status.

This is the guiding identity pattern for #8 and #9 below. **P1-3 is unaffected**
— it ships the Quick Book payment endpoint with the current logged-in-client
guard; the guest-capable conversion is #8/#9 work.

---

## 8. Guest-capable unified Quick Book (deferred-account flow)

- **Problem / context:** The intended Quick Book flow is guest-first (book → pay
  → optional password email after), but the **current** Quick Book path is
  login-required end-to-end: `create_booking` (`client.py`) is `@login_required`
  + `check_client_access()`, so a guest cannot even reach a matched
  `'Matched - Awaiting Payment'` job. The guest-friendly machinery already exists
  for public-booking (`get_or_create_guest_client`, `api.py:2948`; unauthenticated
  `/api/public/book`, `api.py:2986`; CSRF-exempt `api_bp`) but Quick Book does not
  use it.
- **Scope (multi-surface flow change, NOT payment plumbing):**
  1. Make the Quick Book booking entry guest-capable — drop the login wall and
     create/find a shadow client via `get_or_create_guest_client`, mirroring
     `/api/public/book`. Resolve CSRF placement (guest POSTs must live in a
     CSRF-exempt blueprint).
  2. Make the Quick Book payment-init endpoint (P1-3's
     `initiate_quick_book_payment`) guest-capable: it currently uses
     `check_client_access()` (logged-in client). For guests, ownership cannot be
     `current_user`-based — carry identity/authorization another way (email match,
     or a signed token in the `pro_found` payload) and re-verify in the webhook.
  3. Ensure the webhook Quick Book branch sends the "set your password" email for
     shadow accounts (behind `password_reset_required`), matching Scenario D.
  4. Revisit the socket assumptions (`client_job_{job_id}` room) for an
     unauthenticated client (ties into P2-1).
- **Phase / priority:** Product-critical for conversion; sequenced after P1-3.
  Depends on the identity pattern above and overlaps P2-1 (client Pulse UI).

## 9. Identity / client model (deferred-account first)

- **Problem / context:** Today identity is split across `User` (auth),
  `Profile` (per-tenant person data), and ad-hoc shadow accounts. The
  deferred-account decision makes "a person-record exists from first booking,
  password optional later" the *primary* model, not an edge case. The data model
  and helpers should express that directly rather than treating guest accounts as
  a public-booking special case.
- **Scope:** Consolidate the shadow-account/person-record lifecycle into a clear,
  reusable identity layer: one path to create-or-find a person from booking
  details, attach provider-saveable client records regardless of password status,
  and a clean upgrade path (set-password email) to a full login. Every Quick Book
  and public booking entry point uses it (feeds #8).
- **Phase / priority:** Foundational for #8 and the broader marketplace identity
  story; larger refactor, schedule deliberately.

---

## 10. [P1-4 follow-up] Quick Book re-run flow (resurrect, don't duplicate)

- **Problem / context:** P1-4 converts a timed-out Quick Book job to a floating
  lead (`Job.status='Expired'` + a `QuoteRequest(marketplace_status='floating')`),
  and stamps an **identity hook** on that lead: the customer `email` + a
  bidirectional `Job.quote_request_id` link back to the origin job. P1-4 only
  *creates* the hook; the matching/dedup behaviour is this ticket.
- **Scope:**
  1. Re-running a search **resurrects the same request** (re-dispatch the
     existing job / reuse the floating lead via the identity hook) rather than
     creating a brand-new job — so a customer doesn't spawn duplicate floating
     leads by re-pinging.
  2. When a re-run **matches a pro**, **delete (or close) the floating lead** the
     timeout created, so it doesn't linger on the marketplace board after the job
     is taken.
  3. The client prompt must offer **TWO DISTINCT actions**, so intent is explicit:
     - **"Try again"** → same job, re-search (resurrect via the identity hook);
     - **"Make a new request"** → different service, a genuinely new request.
     Conflating these is what allows duplicate floating leads to arise.
- **Phase / priority:** Follow-up to P1-4; pairs with P2-1 (client Pulse UI, which
  owns the prompt) and the #8 guest flow.

## 11. [P1-4 follow-up] Floating-lead acceptance flow + client re-confirmation

- **Problem / context:** P1-4 produces floating leads but nothing lets a pro
  *take* one, and a floating lead has a fixed Quick Book price the customer set
  expectations against — a pro picking it up later may need to adjust.
- **Scope:**
  1. **Floating-lead board UI** — a paginated "floating quick leads" section where
     pros browse unclaimed `marketplace_status='floating'` requests (overlaps the
     P2-2 Available Leads board / P2-3 search fixes).
  2. A pro **accepts** a floating lead (claims it: `marketplace_status='claimed'`,
     assign `tenant_id`).
  3. **Client re-confirmation** before payment/scheduling — "a pro wants your job
     — any adjustments?" — since this is no longer the instant-match path and
     terms/price may shift. Only after the client re-confirms does it proceed to
     payment.
- **Phase / priority:** Follow-up to P1-4; overlaps Phase 2 marketplace UI
  (P2-2/P2-3).

## 12. [P1-4 follow-up] Multi-worker sweep coordination

- **Problem / context:** The P1-4 timeout sweeper is launched per-process from
  `run.py` and runs an in-process loop. Today the app runs as a single
  `socketio.run` process, and the locked exactly-once flip means even a
  duplicated sweep is safe (a second runner just sees `status != 'Searching'` and
  skips). But under a multi-worker deployment (e.g. gunicorn with N workers, or
  bypassing `run.py`), **every worker would run its own sweep loop** — wasteful,
  and the launch would need re-homing since it currently lives in `run.py`.
- **Scope:** Ensure **only one** sweeper runs cluster-wide — leader election, a DB
  advisory lock, a dedicated scheduler/worker process, or an external cron hitting
  a sweep endpoint. Re-home the launch out of `run.py` accordingly.
- **Phase / priority:** Required before any multi-worker / non-`run.py`
  deployment. Not a correctness bug today (idempotent flip), purely
  efficiency/architecture.

## 13. [Roadmap] Quick Book radius tuning — two-layer control

- **Context:** The Haversine/radius machinery already exists in
  `dispatch_live_job` (filters providers by `service_radius_km`). This note is
  about **who controls the radius**, not the math.
- **Two layers:**
  1. **Master-admin** sets sensible per-category defaults/caps (~30km) so nobody
     is pinged for implausibly distant jobs.
  2. **Each provider** sets their OWN business radius in their business settings,
     operating **within** the master-admin bounds.
- **Phase / priority:** Pairs with the pricing catalog (#7); marketplace tuning,
  not near-term blocking.

## 14. [Roadmap] Provider availability + coarse location (NOT live GPS tracking)

- **Context:** To improve dispatch matching, add a simple provider
  **availability** status — "available for Quick Book / busy" — optionally with an
  **occasional coarse location** update (shift-start or manual), so dispatch
  matches on registered service area + current availability.
- **Explicit decision — NO continuous live device-location tracking.** Live GPS
  tracking suits Uber's constantly-moving drivers, but our jobs are long (90+ min)
  and stationary, so live tracking would be over-engineering.
  - *Possible far-future exception:* en-route "your pro is on the way" tracking as
    customer reassurance — **not** for matching, **not** near-term.
- **Phase / priority:** Roadmap; depends on the provider-settings surface and
  pairs with radius tuning (#13).

---

## 15. [Tooling] `npm run lint` script is broken (flat-config vs `--ext`)

- **Location:** `nieuwburg/admin-frontend/package.json` `"lint"` script.
- **Problem:** The script runs `eslint . --ext js,jsx --report-unused-disable-directives
  --max-warnings 0`, but the installed ESLint uses the new **flat config**
  (`eslint.config.js`), where `--ext` is no longer valid — so `npm run lint`
  fails immediately with `Invalid option '--ext'`. Invoking `npx eslint` directly
  also errors (`ERR_PACKAGE_PATH_NOT_EXPORTED: './config'`), a version-mismatch
  symptom. Linting is effectively unusable in this repo today.
- **Risk:** No automated lint gate — style/correctness regressions slip through.
  `vite build` still validates that JSX/imports compile, but that is not a linter.
  Unrelated to any feature work; pre-existing.
- **Fix:** Reconcile the ESLint version with the config style — either drop
  `--ext` (flat config globs by default; set file patterns in `eslint.config.js`)
  and align the eslint/plugin versions, or pin a config-compatible ESLint. Then
  confirm `npm run lint` runs clean.
- **Phase / priority:** Low (tooling). Worth fixing so linting is usable again.

---

## 16. Restructure Quotes vs Leads (inbox/outbox split)

- **Problem / context:** New bookings currently land in **"Quotes"** as `'pending'`,
  conflating **incoming** work (leads the provider should act on) with the
  provider's **outgoing** quotes (what they've submitted to clients). The two are
  different sides of the business and should not share a surface.
- **Target:** Establish a clean inbox/outbox split:
  - **Available Leads = incoming work (inbox)** — Quick Book floating leads +
    quote-request leads to claim/quote (the P2-2 board grows into this).
  - **Quotes = the provider's own submitted quotes + the quote-creation tool
    (outbox / CRM surface).**
- **Touches (cross-cutting):** booking routing (where a new booking/quote-request
  lands), the Quotes view query (stop showing incoming `'pending'` as the
  provider's quotes), dashboard **"pending quotes"** counts, and the quote-tool's
  home.
- **Phase / priority:** Sequence **after** the leads board (P2-2) and the
  marketplace surface (P2-3) exist — they establish the inbox side this splits
  against. Cross-cutting; its own design + ticket. Related vision: [[R1]].

---

## 17. [Bug] `/api/user/me` is double-prefixed → ProviderDispatchModal never mounts — ✅ RESOLVED (commit `7618acd`)

**Fixed:** decorator changed to `@bp.route('/user/me')` so it resolves at
`/api/user/me`. Verified end-to-end (200 + `tenant_id` delivered, frontend mount
gate true, and a joined tenant-room client receives `incoming_lead`). Audit
confirmed it was the sole double-prefixed route on `api_bp`. Original report below
for reference.


- **Location:** `nieuwburg/routes/api.py` `get_current_user_info` declared
  `@bp.route('/api/user/me')`, but `api_bp` is registered with `url_prefix='/api'`
  — so the route resolves to **`/api/api/user/me`**. The frontend
  (`admin-frontend/src/App.jsx:57`) fetches **`/api/user/me`** (single prefix),
  which is **not registered → 404**.
- **Impact:** `fetchUserContext()` fails → `currentTenantId` is never set →
  `{currentTenantId && <ProviderDispatchModal .../>}` never renders → providers
  **never receive `incoming_lead` broadcasts in the UI**. Engine A's provider-side
  realtime (the Quick Book accept path) is effectively dead at the UI level.
- **Discovered:** during P2-2 (the same `/api`-prefix trap that double-prefixed
  the new board routes before they were corrected). This is the **only** remaining
  `/api/api/...` route.
- **Fix:** change the decorator to `@bp.route('/user/me')` (the blueprint adds the
  `/api`). One line. Then re-verify ProviderDispatchModal mounts and receives
  leads. Worth a quick audit for any other mis-prefixed `@bp.route('/api/...')` in
  this file.
- **Phase / priority:** **High** — it silently breaks the provider side of the
  live marketplace. Small fix; own ticket (kept out of P2-2 for scope hygiene).

---

## 18. [P2-3 follow-up] Render the quote-request section of the Available Leads board

- **Location:** `nieuwburg/admin-frontend/src/.../AvailableLeads.jsx` (frontend only).
- **Context:** The P2-2 GET already returns **both** `lead_types` (floating
  Quick Book leads **and** quote requests); the board currently renders only the
  floating-leads section.
- **Task:** Display the second section — the quote requests — below the floating
  leads, **visually distinct** from them, so providers see both kinds of
  available work. No backend change needed.
- **Phase / priority:** Phase 2 follow-up — the second half of P2-3's surface,
  split out so the search-endpoint fix could ship on its own. Frontend-only.

---

## 19. [Tech debt] Quick Book frequency set duplicated in 3 places

- **Location:** `nieuwburg/routes/master.py` `ALLOWED_FREQUENCIES` (authoritative —
  validates catalogue price rows), `admin-frontend/src/components/master/MasterServiceModal.jsx`
  (the master item-editor dropdown), and `admin-frontend/src/components/ClientBookingModal.jsx`
  (hardcoded `<option>`s the client submits).
- **Problem:** The three copies match today (`Once-off` / `Weekly` / `Bi-Weekly`
  / `Monthly`, verified character-for-character), but a future edit to one that
  misses the others would **silently break price resolution**: the client would
  send a frequency with no matching `MarketplaceServicePrice` row, so
  `resolve_price_for_job` returns `None` and payment-init **refuses** — no error,
  just a booking that can't be paid.
- **Fix (someday):** single source of truth — e.g. serve the allowed set from the
  backend (a small endpoint or bootstrap payload) and have both React surfaces
  consume it, or share one constant. Removes the drift risk.
- **Phase / priority:** **Low — correctness-adjacent, not a current bug.** Worth
  doing before the frequency set changes or grows.

---

## Platform features (F-series — from the master-admin design note)

These fall out of `Nieuwburg_Blitz_MasterAdmin_and_Pricing_Design.md` (decisions
#1–#8, unified service-item model, 4A sequencing). **F2** = #7 (pricing catalog);
**F3** = the master-admin item-management UI (a later increment of #7). The rest
are tracked here. Sequence per the design note's §4/§5.

### F1. Master-admin role (foundation) 🔑

- **What:** Model the platform owner as a distinct `'master_admin'` role with
  **no `tenant_id`** (the `User.role` column already supports this) + a small
  `is_master_admin(user)` helper/decorator gating platform-level surfaces.
  Retire the "HQ = first Tenant" remnant. **Replaces** the earlier
  `Tenant.is_platform_owner` stopgap.
- **Why:** Bedrock for everything platform-level (pricing CRUD, review queue,
  platform area). Per design decision #1 (master admin is a role, not a tenant).
- **Phase / priority:** **Near-term foundation — first increment under 4A**, ahead
  of the pricing data model. Aligns with [[#9]] (identity model). See the design
  note §3/§4.

### F4. Tenant service-item creation + master-admin review queue

- **What:** Providers add service items/categories via setup/business settings;
  items enter **quote-only** and **`pending`**; master admin approves/rejects
  before they go live (publicly visible).
- **Why:** Real moderation gate — a provider must not publish arbitrary/
  inappropriate services to a public marketplace (design decision #4).
- **Phase / priority:** **Pre-launch necessity** for a public marketplace.
  Depends on F1 (the role) and the unified item model (F2). Its own design + ticket.

### F5. Service-discovery surface ("What services do you need?")

- **What:** A call-to-action section on the landing page + client dashboard
  showing available services as tiles (Cleaning, Plumbing, Gardener, …), fed by
  the approved/active items in the unified service-item model.
- **Why:** The client-facing entry into the marketplace; a display surface, not a
  new engine (design decision/§3 F5).
- **Phase / priority:** A basic version is likely pre-launch; depends on the item
  model (F2) and benefits from the review gate (F4). Its own scoped ticket.

### F6. Master-admin platform area + privacy model

- **What:** The master-admin's own dashboard/sections for running the *platform*
  (Quick Book catalog mgmt, analytics/insights, blog/content, the review queue);
  repurpose tenant-admin surfaces that don't apply (e.g. the bookings calendar).
  **Plus** the privacy/permission model: master admin must NOT see tenants'/
  end-users' sensitive data (private client lists, earnings, banking, passwords).
- **Why:** Platform owner ≠ god-mode (design decision #6) — an ethical/legal
  constraint and a first-class requirement, not an afterthought.
- **Phase / priority:** Larger; likely several increments. The **core privacy
  rules are pre-launch**; the fuller analytics/insights/blog tooling can be
  leaner/post-launch. Gated by F1. See the design note §5.

### F7. Service catalogue population + answer-driven pricing (rule engine)

- **What:** Populate the catalogue over time and build the answer-driven pricing
  it implies — the reusable 6-type question toolkit (tile-grid, segmented select,
  number stepper, quantity counter, yes/no, photo/note), per-service question
  sets, and the **price-factor rule engine** where answers drive the price
  (home-size → hours, extras add-ons, running price bar, etc.).
- **Design reference:** `service-catalogue-design.md` (root) — the two lists,
  shared-skeleton bones, the question-type toolkit, and per-service question sets
  + price factors. This is the spec for F7.
- **Relationship to #7:** #7's data-model increment stores a **flat or per-frequency
  price** per `MarketplaceService` only. **Answer-driven pricing is explicitly NOT
  in #7** — it is F7. The #7 model is the substrate F7's rule engine will price
  against.
- **Phase / priority:** Post the #7 pricing foundation; large, ongoing. Its own
  design (the reference doc) + sequenced tickets. Includes the deferred
  "one-off-with-inputs" pricing mode.

---

## R1. [Roadmap / Vision] Two-sided model: lead-gen marketplace + tenant CRM/FMS

**Captured 2026-06-28 as product direction — NOT a near-term ticket. Do NOT pull
into current Phase 2 work. Each bullet below is its own future design + ticket,
well beyond Phase 2/3.**

The product is two-sided:

1. **Lead generation** (Quick Books + quote requests) — the **marketplace** side.
   Revenue from Quick Book admin fees. This is the hook that brings providers in.
   *Available Leads* (P2-2) is the entry surface here — the provider's **inbox** of
   incoming marketplace work.
2. **Full CRM / FMS for tenants** — the **subscription** product where a provider
   runs their whole business: their OWN self-sourced quotes, staff, jobs, clients,
   field management. The recurring-revenue product. *Quotes* is the provider's
   **outbox** — their own outgoing quotes + the quote-creation tool.

This reinforces an **inbox/outbox split**: *Available Leads* = incoming
marketplace work to claim; *Quotes* = the provider's own outgoing quotes and the
creation tool.

**CRM features implied (large, deliberate, post-marketplace-foundation):**
- **Draft-mode quotes** — save an incomplete quote and resume later.
- **Persistence of in-progress work** — if a provider steps away, the network
  drops, or they close the device, the system remembers where they left off.
- **Click-to-reserve** — clicking a quote-request lead in *Available Leads*
  temporarily **holds** it for that provider while they build the quote, until
  finished or the lead is gone. (A softer evolution of P2-2's exclusive claim:
  P2-2 ships a hard claim now; click-to-reserve is the future hold-while-quoting
  refinement.)
- **Quote-creation tool lives in *Quotes*** as a CRM surface (the outbox side of
  the split).

**Phase / priority:** Roadmap direction for after the marketplace foundation
(Phase 2/3) is complete. Informs framing now; builds later.