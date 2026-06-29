# Nieuwburg Blitz — Status & Roadmap

**Companion to:** `Nieuwburg_Blitz_Remediation_Plan.md` (the original sequenced fix plan).
**Purpose:** A current "where we are" record plus the sequenced road from here to a launchable product.
**Basis:** Verified directly against the codebase (the actual files were read, not memory/summaries). Original basis was the 2026-06-28 snapshot; this revision reflects the work through commit `8d93d31`.
**Last updated:** 2026-06-29 (revised after: P2-3, the SPA-shell dev-mode fix, the first P3-1 search increments, and BACKLOG #1).

---

## 1. The one-paragraph picture

The original remediation plan is now **complete**: Phases 0, 1, and 2 are all done and verified (P2-3 shipped), and **Phase 3 (P3-1 behavioral polish) is in progress**. Along the way a high-severity bug (#17) and a **launch-blocking security leak (#1, cross-tenant read/delete)** were both fixed, and a **production-breaking SPA-shell bug** was discovered and fixed (the admin/client React app only loaded from the Vite dev server, so it never rendered when running on Flask alone). The codebase on disk **exactly matches** the ticket history — every committed change is present and correct, with no drift. What has *grown* is the backlog: from "a few open decisions" into a substantial product roadmap. The important distinction now is that **"remediation plan complete" and "product ready to launch" are two different milestones** — the gap between them is the backlog work in Section 4, most of which gates Quick Book actually taking live payments. With #1 closed, the single biggest remaining launch gate is **#7 (the pricing catalog)** — until it lands, Quick Book cannot take a real payment.

---

## 2. Where we are — done and verified

All items below were confirmed by reading the actual code in the 2026-06-28 snapshot.

### Phase 0 — Foundation (complete + verified)

| Ticket | What it secured | Verified |
|---|---|---|
| P0-1 | Flask-Migrate baseline; `db.create_all()` removed from the factory; schema owned by migrations | Migration chain linear from `35f74904ead7` |
| P0-2 | `QuoteRequest.marketplace_status` enum (direct/floating/claimed/closed) replacing the nullable-`tenant_id`-as-state hack | Migration `9d2c9f06ab9f` |
| P0-3 | Double-booking lock fixed — `accept_lead` locks the **Job** row and re-asserts status under the lock | **30/30 concurrency test; saved as `tests/p0_3_concurrency_smoke.py`** |
| P0-4 | SQLite → Postgres (Supabase); dotenv load-order fix; psycopg2 added | Running on Postgres, schema migrated + seeded |

### Phase 1 — Money + dispatch (complete)

| Ticket | What it did | Notes |
|---|---|---|
| P1-1 | Fixed the dead `datetime` import that crashed dispatch | One-line fix |
| P1-2 | Idempotent Paystack webhook (signed POST, dedup on `data.id`, deferred side effects, demoted GET callback) | Failure taxonomy intact; a real duplicate-payment bug was caught and fixed in review |
| P1-3 | Quick Book payment loop + `Job` status lifecycle (`STATUS_SEARCHING/AWAITING_PAYMENT/PAID_SCHEDULED`); `Job.payment_reference`; the `resolve_price_for_job` price seam | Loop is code-complete; **refuses payment until pricing exists** (see #7) |
| P1-4 | 60→120s dispatch timeout → floating-lead conversion; two-armed sweep; locked exactly-once conversion; identity hook; background sweeper | Sweeper start + tick empirically verified |

### Phase 2 — UI on the safe foundation (complete)

| Ticket | Status | Notes |
|---|---|---|
| P2-1 | ✅ Done | Client "Pulse" socket wired; `join_client_job_room` handler added; E2E proven (client joins room, receives `no_pro_found`) |
| P2-2 | ✅ Done | Available Leads board (floating section) + atomic exclusive claim; concurrent double-claim verified (one winner, one 409); GET not tenant-scoped |
| **P2-3** | ✅ Done | Marketplace search fixed (single query, outer-joined `BusinessSettings`, dropped nonexistent reviews fields, null-address guard); verified vs Postgres. **Scope decision:** P2-3 = the search-endpoint fix only; the quote-request *board-section rendering* was split out to **BACKLOG #18** (frontend-only). |
| #17 | ✅ Fixed | `/api/user/me` double-prefix — un-broke the provider dispatch modal mounting |

### Phase 3 — Polish (in progress)

| Ticket | Status | Notes |
|---|---|---|
| P3-1 | 🟡 In progress | Behavioral polish (AJAX/no-reload — *not* the visual overhaul; see Section 5). **Important reframe:** the legacy `admin_*.html` Jinja content templates are **orphaned** (no route renders them) — the real admin/client UI is the React SPA, which already uses background API calls. So genuine P3-1 work lives *inside the SPA*. Shipped so far: client-side live search/filter on **Invoices, Quotes, ActivityLog, Applications** (data already loaded, no new endpoints); stripped leftover debug logs. Remaining: optional Blog search; standardize Clients/Staff onto the shared `useDebounce` hook; verify instant-update (vs refetch) on a few mutation paths. |

**Real-time loop status:** With P2-1 and #17 both done, the Quick Book loop is now wired end-to-end on **both** client and provider sides — client searches → provider modal mounts and shows the lead → accept fires `pro_found` to the client; or timeout → floating lead → client hears `no_pro_found` → provider sees it on the board and can claim it.

### Out-of-band fix — SPA shell dev-mode loading (✅ Fixed)

Not a remediation ticket: the admin/client SPA shells (`admin_base.html`, `client_dashboard.html`) loaded React **only** from the Vite dev server (`http://localhost:5173`), so running on Flask alone (e.g. production, or `python run.py` without `npm run dev`) rendered the server-side shell but left the React-mounted content area **blank**. Fixed with an env-conditional flag `VITE_DEV_SERVER` (default **false** → load the built `static/admin-assets/index.js`; set true for dev hot-reload); the client shell also now loads the built CSS in the prod branch. Confirmed live: admin content renders on Flask alone.

---

## 3. The original remediation plan — DONE

The original plan's tickets (P0-1 … P3-1) are all delivered. The only tickets still open are P3-1 *increments* (behavioral polish, ongoing) and follow-ups that were deliberately split into the backlog.

### P2-3 — Marketplace search fix (✅ done)

Both confirmed bugs in `nieuwburg/routes/marketplace.py` are fixed: the discarded `BusinessSettings`/`ServiceCategory` joins (location search now works — `BusinessSettings` is outer-joined so settings-less tenants still surface, with the address guarded) and the nonexistent `member_since`/`rating`/`review_count` fields (dropped from the payload — the resolved open decision: no reviews feature yet). Verified against Postgres. The **quote-request board-section rendering** was split out to **BACKLOG #18** (frontend-only; the P2-2 GET already returns both lead types).

### P3-1 — AJAX behavioral polish (🟡 in progress)

Snappiness/no-reload behavior, distinct from the visual overhaul in Section 5. Note the reframe in Section 2: the legacy Jinja admin templates are orphaned, so this work targets the React SPA, which already does background API calls. Live search/filter shipped to Invoices/Quotes/ActivityLog/Applications; remaining items are minor (see the Phase 3 table).

---

## 4. The road to launch — sequenced backlog

The backlog stands at 18 items + a vision note (#1 now resolved; #2/#17 previously resolved; #18 added). Rather than a flat list, here it is grouped by **what gates a Quick Book launch**, in suggested order. Items marked **🔴 launch-blocker** must land before taking real money or going public.

### Tier 1 — Must land before Quick Book can transact

| # | Item | Why it gates launch |
|---|---|---|
| **7** 🔴 | **Master-admin Quick Book pricing catalog + frequency capture** | The price seam returns `None` for every job today, so payment-init always refuses. Needs: per-category pricing (frequency-based / one-off-flat / one-off-with-inputs), Quick-Bookable vs quote-only flag, public price display, and capturing the (currently-dropped) frequency selection onto the `Job`. **Nothing transacts until this exists. With #1 closed, this is the single biggest remaining launch gate.** |
| **1** ✅ | **Security: cross-tenant read/delete on `QuoteRequest`/`Quote`** — **RESOLVED** (commit `0ee70e7`) | Three `api.py` endpoints fetched by id with no `tenant_id` scoping. The audit found a **third** site beyond the original note — a *destructive* cross-tenant `Quote` deletion — so the fix covered all three (read + two deletes), each now tenant-scoped with 404 on miss. The marketplace floating-lead paths were correctly left cross-tenant. Verified vs Postgres (16/16). |

### Tier 2 — Required for the intended customer experience

| # | Item | Notes |
|---|---|---|
| **8** | Guest-capable unified Quick Book (deferred-account flow) | Public modal feeds the same dispatch engine; guest books without a signup wall; "set your password" email after payment. Adopts the deferred-account pattern already in the public-booking path. Pairs with #9. |
| **9** | Identity / client model (deferred-account first) | Untangle the three meanings of "client": signed-up-vs-not, has-booked-vs-not, and a provider's private saved-client list. Foundational; informs #8. |
| **11** | Floating-lead acceptance flow + client re-confirmation | When a pro claims a floating lead, the client is asked "a pro wants your job — any adjustments?" before payment/scheduling (a stale lead must not silently become a booking). The piece P2-2 deliberately stopped short of. |
| **18** | Render the quote-request section of the Available Leads board | Frontend-only (`AvailableLeads.jsx`): the P2-2 GET already returns both `lead_types`; display the quote-request section below the floating leads, visually distinct. The board half deliberately split out of P2-3. |
| **10** | Quick Book re-run flow (resurrect, don't duplicate) | "Try again" resurrects the *same* request (matched via the identity hook P1-4 stamped) and deletes the floating lead on re-match; a separate "Make a new request" button keeps intent explicit so duplicates can't arise. |
| **16** | Restructure Quotes vs Leads (inbox/outbox split) | "Available Leads" = incoming work (inbox); "Quotes" = the provider's own outgoing quotes + creation tool (outbox/CRM surface). New bookings stop landing in "Quotes" as pending. Sequence after the leads board + marketplace surface exist. |

### Tier 3 — Operational hardening (before meaningful volume)

| # | Item | Notes |
|---|---|---|
| **6** | Alerting for unroutable / failed Paystack charges | The webhook logs these at WARNING/ERROR but there's no real alert channel (email/Slack/Sentry). Needed before payment volume so a stuck payment can't go unnoticed. |
| **12** | Multi-worker sweep coordination | The dispatch sweeper runs per-process; under multiple workers it'd run N times. Safe today (single process; the locked flip is idempotent) but needs leader-election / advisory-lock / dedicated process before multi-worker deployment. |
| **3** | Admin dashboard counts hide floating leads | Dashboard counts are tenant-scoped, so floating (`tenant_id IS NULL`) leads don't appear there — correct for now, but a note for whoever touches those counts. |

### Tier 4 — Tuning & roadmap (post-launch fine-tuning)

| # | Item | Notes |
|---|---|---|
| **13** | Quick Book radius tuning (two-layer) | Master-admin per-category default/cap (~30km) + provider's own radius in their settings, within the cap. Machinery (Haversine + `service_radius_km`) already exists — this is config + a provider setting. |
| **14** | Provider availability + coarse location (NOT live GPS) | A simple "available / busy" status + optional occasional coarse location. **Explicitly decided against** continuous live GPS tracking — suits Uber's moving drivers, not 90-min stationary jobs. (Possible far-future: en-route "your pro is on the way" view for customer reassurance, not for matching.) |

### Tier 5 — Tech debt & tooling (low priority, do when convenient)

| # | Item | Notes |
|---|---|---|
| **5** | `datetime.utcnow()` deprecated on Python 3.12+ | Modernize to `datetime.now(timezone.utc)` **codebase-wide at once** (mixing naive/aware datetimes causes comparison errors). Harmless warning today. |
| **4** | venv `flask.exe` points at a stale sibling venv | Use `python -m flask`; recreate the venv someday. |
| **15** | `npm run lint` script broken (flat-config vs `--ext`) | Fix the lint config so linting is usable. |

### Vision (not a ticket)

| # | Item |
|---|---|
| **R1** | Two-sided model: lead-gen marketplace (Quick Books + quote requests; revenue from Quick Book admin fees) **+** a full CRM/FMS subscription where tenants run their whole business (own quotes, staff, jobs, clients, field management). Implies future CRM features — draft-mode quotes, resume-where-you-left-off, click-to-reserve a lead while quoting. Each its own future design + ticket. |

---

## 5. The Visual & UX Overhaul phase (the "gorgeous SaaS" goal)

**Goal:** transform the app from "works correctly" into a polished, professional-looking SaaS product — a unified visual system (typography, color, spacing, components) across every surface: the public marketing site, the client dashboard, the provider dashboard, and the master-admin panel.

**This is achievable.** The React/Vite SPA foundation supports a complete visual overhaul without architectural changes.

**When: near the end, after the functional surfaces are built and stable. Not now, and not woven into the functional tickets.** The reasoning:

1. **Don't restyle a moving target.** Several Tier 1–2 features (pricing catalog, guest flow, quote-request board, the Quotes/Leads restructure, the acceptance flow) *create or change screens*. Styling now means re-styling as those land — paying for polish twice.
2. **A coherent redesign needs the whole picture.** The best result comes from designing one visual *system* and applying it consistently across all surfaces at once — which requires those surfaces to exist first (e.g. the master-admin pricing screen doesn't yet).
3. **Function-then-form** — the same separation-of-concerns discipline that has carried the project: get every flow *doing the right thing*, then make it *look* right in one focused pass.

**Interim guidance for the functional tickets:** build new screens (pricing admin, guest flow, etc.) *functional and reasonably clean*, but don't gold-plate their styling — the overhaul will unify everything later. Avoid perfecting the look of a screen you'll restyle anyway.

**Two distinct kinds of "polish" — don't conflate them:**
- **P3-1 (behavioral):** AJAX/no-reload interactions, snappiness. In the original plan; can be done earlier.
- **Visual overhaul (this phase):** the actual styling/typography/color/component system — the "gorgeous" part. Its own dedicated phase near the end.

---

## 6. Suggested overall sequence from here

Done since this doc was first written: ~~P2-3~~ ✅, ~~#1 (security)~~ ✅, plus the SPA-shell fix and the first P3-1 search increments.

1. **#7 (pricing catalog + frequency capture)** — the big one that makes Quick Book able to transact. Now the top remaining launch gate.
2. **#9 → #8** — identity model, then the guest-capable unified Quick Book (deferred-account flow).
3. **#11 → #10** — floating-lead acceptance/re-confirmation, then the re-run flow.
4. **#16** — Quotes/Leads inbox/outbox restructure (now that the leads + marketplace surfaces exist). **#18** (quote-request board section) fits naturally near here.
5. **#6, #12** — payment alerting and multi-worker sweep coordination (operational hardening before volume).
6. **P3-1 remainder** — finish the AJAX behavioral polish (mostly done; minor items left).
7. **Visual & UX overhaul phase** — the full design pass across all surfaces (Section 5).
8. **#13, #14, tech-debt (#5/#4/#15)** — tuning and cleanup, as convenient.

> Tiers, not deadlines. With #1 closed, **#7 (pricing)** is now the single item that most defines "can we launch Quick Book at all." The visual overhaul is intentionally late so it's done once, on a finished product.

---

## 7. Health notes (through commit `8d93d31`)

- **No drift.** Every committed ticket's code is present and matches the ticket history — the per-diff review discipline held.
- **Migration chain is clean and linear** (no branches/orphans).
- **The concurrency-critical locks are intact and correct** — `accept_lead` (P0-3) and `convert_job_to_floating_lead` (P1-4) both lock the contended row and re-assert state under the lock; the P2-2 claim endpoint follows the same pattern.
- **The P0-3 concurrency test is saved** in `tests/` — a permanent, re-runnable proof.
- **Cross-tenant scoping audited (BACKLOG #1).** A full sweep of by-id `QuoteRequest`/`Quote` fetches confirmed the three leaking sites are now tenant-scoped, the deliberate marketplace cross-tenant paths are intact, and the remaining by-id fetches were already scoped (or, in `admin.py`, do a post-fetch tenant check).
- **Architecture clarified.** The admin/client UI is the **React SPA**; the legacy `admin_*.html` Jinja content templates are **orphaned** (no route renders them) — relevant to anyone scoping further "admin polish." The SPA shells now load the built bundle by default (the dev-mode-only loading bug is fixed).
- **Governing docs are current** — `CLAUDE.md`, the remediation plan, and a well-maintained `BACKLOG.md` (18 items + vision; #1/#2/#17 resolved, #18 added).
