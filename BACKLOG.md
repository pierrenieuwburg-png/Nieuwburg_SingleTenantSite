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