# Backlog

Deferred issues recorded during other work. Not yet ticketed into the phased
remediation plan unless noted. Line numbers are anchors and will drift as code
changes — treat them as starting points, not permanent addresses.

---

## 1. [Security] Strip-tenant-filter on QuoteRequest fetch — cross-tenant read

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

## 2. [P2-3 known] marketplace `/search` endpoint 500s on any result

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

## 7. [P1-3 prerequisite] Master-admin Quick Book pricing catalog + frequency capture

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