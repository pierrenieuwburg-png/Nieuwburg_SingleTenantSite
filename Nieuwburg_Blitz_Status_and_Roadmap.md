# Nieuwburg Blitz — Status & Roadmap

**Companion to:** `Nieuwburg_Blitz_Remediation_Plan.md` (the original sequenced fix plan).
**Purpose:** A current "where we are" record plus the sequenced road from here to a launchable product.
**Basis:** Verified directly against the codebase snapshot dated 2026-06-28 (not from memory or summaries — the actual files were read).
**Last updated:** 2026-06-29.

---

## 1. The one-paragraph picture

The original remediation plan is **nearly complete**: Phases 0 and 1 are fully done and verified, Phase 2 is one ticket from finished (P2-1 and P2-2 shipped; P2-3 remains), and a high-severity bug found along the way (#17) has been fixed. The codebase on disk **exactly matches** the ticket history — every committed change is present and correct, with no drift. What has *grown* is the backlog: from "a few open decisions" into a substantial product roadmap. The important distinction now is that **"remediation plan complete" and "product ready to launch" are two different milestones** — the gap between them is the backlog work in Section 4, most of which gates Quick Book actually taking live payments.

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

### Phase 2 — UI on the safe foundation (in progress)

| Ticket | Status | Notes |
|---|---|---|
| P2-1 | ✅ Done | Client "Pulse" socket wired; `join_client_job_room` handler added; E2E proven (client joins room, receives `no_pro_found`) |
| P2-2 | ✅ Done | Available Leads board (floating section) + atomic exclusive claim; concurrent double-claim verified (one winner, one 409); GET not tenant-scoped |
| **P2-3** | ⬜ **Next** | Marketplace search fix + the quote-request section of the board |
| #17 | ✅ Fixed | `/api/user/me` double-prefix — un-broke the provider dispatch modal mounting |

### Phase 3 — Polish

| Ticket | Status |
|---|---|
| P3-1 | ⬜ AJAX enhancements (behavioral polish — *not* the visual overhaul; see Section 5) |

**Real-time loop status:** With P2-1 and #17 both done, the Quick Book loop is now wired end-to-end on **both** client and provider sides — client searches → provider modal mounts and shows the lead → accept fires `pro_found` to the client; or timeout → floating lead → client hears `no_pro_found` → provider sees it on the board and can claim it.

---

## 3. Finishing the original remediation plan

Only two tickets remain from the original plan:

### P2-3 — Marketplace search fix + quote-request board section (next)

Two confirmed bugs in `nieuwburg/routes/marketplace.py` (verified present in the snapshot):

1. **Discarded join.** The query is built with the `BusinessSettings`/`ServiceCategory` joins, then **rebuilt without them**, yet the `location` filter still references `BusinessSettings.business_address` → error on any location search.
2. **Nonexistent fields.** The output reads `item.member_since`, `item.rating`, `item.review_count` — none exist on `ServiceItem` → `AttributeError` → 500 on any non-empty result.

**Plus:** render the quote-request section of the Available Leads board (the P2-2 GET endpoint already returns both lead types — it's mostly front-end work to display the second section below the floating leads, visually distinct).

**Open decision for P2-3:** the missing rating/tenure fields — add them as real model fields, or drop them from the payload until a reviews feature exists. (Recommendation: drop them for now; reviews are a future feature.)

### P3-1 — AJAX enhancements (behavioral polish)

Convert remaining full-page-reload form submissions in the admin panel to background API calls; live search/filter/instant table updates. This is about *behavior/snappiness*, distinct from the visual overhaul in Section 5.

---

## 4. The road to launch — sequenced backlog

The backlog has grown to 17 items + a vision note. Rather than a flat list, here it is grouped by **what gates a Quick Book launch**, in suggested order. Items marked **🔴 launch-blocker** must land before taking real money or going public.

### Tier 1 — Must land before Quick Book can transact

These are the reason Quick Book "works" today but cannot take a real payment.

| # | Item | Why it gates launch |
|---|---|---|
| **7** 🔴 | **Master-admin Quick Book pricing catalog + frequency capture** | The price seam returns `None` for every job today, so payment-init always refuses. Needs: per-category pricing (frequency-based / one-off-flat / one-off-with-inputs), Quick-Bookable vs quote-only flag, public price display, and capturing the (currently-dropped) frequency selection onto the `Job`. **Nothing transacts until this exists.** |
| **1** 🔴 | **Security: cross-tenant read on `QuoteRequest`** | `api.py` fetches `QuoteRequest` by id with **no** `tenant_id` scoping (two spots marked "DIAGNOSTIC/MVP MODE: Strip Tenant Filter"). Tenant A can read tenant B's leads by guessing sequential ids. **Hard pre-launch blocker** — a real data-leak. One-ish-line fix (re-add tenant scoping, 404 on mismatch). |

### Tier 2 — Required for the intended customer experience

| # | Item | Notes |
|---|---|---|
| **8** | Guest-capable unified Quick Book (deferred-account flow) | Public modal feeds the same dispatch engine; guest books without a signup wall; "set your password" email after payment. Adopts the deferred-account pattern already in the public-booking path. Pairs with #9. |
| **9** | Identity / client model (deferred-account first) | Untangle the three meanings of "client": signed-up-vs-not, has-booked-vs-not, and a provider's private saved-client list. Foundational; informs #8. |
| **11** | Floating-lead acceptance flow + client re-confirmation | When a pro claims a floating lead, the client is asked "a pro wants your job — any adjustments?" before payment/scheduling (a stale lead must not silently become a booking). The piece P2-2 deliberately stopped short of. |
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

1. **P2-3** — finish the original plan's Phase 2 (marketplace search fix + quote-request board section).
2. **#1 (security)** — close the cross-tenant read. Small and a hard pre-launch blocker; do it early so it's not forgotten.
3. **#7 (pricing catalog + frequency capture)** — the big one that makes Quick Book able to transact.
4. **#9 → #8** — identity model, then the guest-capable unified Quick Book (deferred-account flow).
5. **#11 → #10** — floating-lead acceptance/re-confirmation, then the re-run flow.
6. **#16** — Quotes/Leads inbox/outbox restructure (now that the leads + marketplace surfaces exist).
7. **#6, #12** — payment alerting and multi-worker sweep coordination (operational hardening before volume).
8. **P3-1** — AJAX behavioral polish.
9. **Visual & UX overhaul phase** — the full design pass across all surfaces (Section 5).
10. **#13, #14, tech-debt (#5/#4/#15)** — tuning and cleanup, as convenient.

> Tiers, not deadlines. #1 (security) and #7 (pricing) are the two that most define "can we launch Quick Book at all." The visual overhaul is intentionally late so it's done once, on a finished product.

---

## 7. Health notes from the code review (2026-06-28 snapshot)

- **No drift.** Every committed ticket's code is present and matches the ticket history — the per-diff review discipline held.
- **Migration chain is clean and linear** (5 migrations, no branches/orphans).
- **The two concurrency-critical locks are intact and correct** — `accept_lead` (P0-3) and `convert_job_to_floating_lead` (P1-4) both lock the contended row and re-assert state under the lock; the P2-2 claim endpoint follows the same pattern.
- **The P0-3 concurrency test is saved** in `tests/` — a permanent, re-runnable proof.
- **Governing docs are current** — `CLAUDE.md`, the remediation plan, and a well-maintained `BACKLOG.md` (17 items + vision).
