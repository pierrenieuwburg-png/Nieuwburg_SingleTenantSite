# Nieuwburg Blitz — Master-Admin Platform & Quick Book Pricing (Design Note)

**Type:** Focused design note (companion to the Status & Roadmap doc).
**Purpose:** Resolve the foundational decisions that #7 (Quick Book pricing) surfaced, capture the wider platform vision that came with them, and re-scope the first increment so it builds on correct bedrock instead of a stopgap.
**Status:** Draft for Pierre's review. Not yet law; not yet handed to Claude Code.
**Date:** 2026-06-30.

---

## 0. Why this note exists

Scoping #7 (the Quick Book pricing catalog) surfaced that pricing sits on top of a bigger, previously-implicit question: **what is the master admin, and how do platform-owned things (Quick Book items, pricing, the service catalog, the public discovery surface) relate to tenant-owned things (a provider's own quotes, clients, staff)?**

This note locks the foundational decisions, names the features that fall out of them, and sequences the work. It deliberately does **not** try to build everything now — it makes the path explicit so each piece can be built one well-scoped increment at a time, the same discipline used through Phases 0–2.

---

## 1. Locked decisions (from the design conversation)

1. **Master admin is its own role — NOT a tenant.** The platform owner runs the marketplace; they are not a tenant wearing an admin hat. (Analogy: the building owner may live on-site, but he isn't a tenant — he runs the place.) The current "HQ = first Tenant" arrangement is a single-tenant remnant and must not carry forward. Model master-admin properly.

2. **Quick Book pricing is master-admin-set; quote items are provider-priced.** The platform pre-defines and prices Quick Book items (it controls them, takes the admin fee). Quote-requested items are priced by the provider when they quote — the platform may *suggest* pricing models/tips but does not set the price.

3. **Quick-Bookable is a property of the specific service item, not the category.** Within one category (e.g. *Cleaning*), some items are Quick-Bookable at a fixed price (*General Indoor Cleaning*) and others are quote-only (*Deep Cleaning* — too variable to pre-price). Pricing and bookability live at the **service-item** level. Items may nest under a category or stand free.

4. **Tenant-created items default to quote-only AND go through master-admin review before going live.** Providers can add service items (and categories) via setup/business settings, but they enter as quote-only and **pending review**; master admin approves before they become publicly visible. This is a real moderation gate (a provider must not be able to publish arbitrary/inappropriate services to a public marketplace), not polish.

5. **Master admin gets its own platform area — not the tenant admin panel.** Its own dashboard and sections suited to running the *platform* (Quick Book catalog management, analytics/insights, blog/content, review queue). Some tenant-admin surfaces don't apply (e.g. the bookings calendar) — repurpose rather than necessarily delete.

6. **Master admin must NOT see tenants' or end-users' sensitive data.** Being platform owner is not god-mode. No visibility into a provider's private client list, their earnings, or any end-user's banking details / passwords. This is an ethical and (often) legal constraint, and a design principle from the start: master-admin tooling is for running the platform, not surveilling tenants' businesses or users' private data.

7. **Pricing is modelled at service level, not category level.** (Confirmed; the expensive-to-reverse call.) The priced/bookable unit is the specific service item.

8. **First pricing version handles frequency-based + one-off-flat only.** "One-off-with-inputs" (e.g. tiling needs area → formula) is deferred to its own later ticket.

---

## 2. The unified service-item model (the core data shape)

Everything above points to **one flexible "platform service item" concept**, not two parallel systems. A single item type that can be either Quick-Bookable or quote-only, master-created or tenant-created, used for **both** display (the discovery tiles) **and** pricing (Quick Book charges).

Conceptual shape (names to be finalised at build time):

- **Service item** — the bookable/quotable unit a client sees and selects.
  - `name`, optional `category` (nullable — items may stand free), `is_active`.
  - `is_quick_bookable` — true only when master admin has set it up with a price; tenant-created items default false.
  - `pricing_mode` — `frequency` | `flat` (with-inputs deferred); only meaningful when Quick-Bookable.
  - `flat_price` — used when `pricing_mode='flat'`.
  - `created_by` / ownership — distinguishes master-created (platform Quick Book items) from tenant-created (quote-only, needs review).
  - `review_status` — `pending` | `approved` | `rejected` (tenant-created items start `pending`; master-created are inherently approved).
- **Quick Book price rows** — for frequency-mode items: `(service_item, frequency, price)` with a uniqueness constraint per `(item, frequency)`.

> **Open modelling question for build time:** whether the platform Quick Book catalog and the tenant-created quote items are literally the *same* table with flags (one unified model) or closely-related tables. The conversation leans unified ("items can stand freely," "manage regardless of type"). Recommendation: one unified model with the flags above — but confirm at the first schema increment, since it's expensive to reverse.

**Job capture:** the `Job` stores the chosen `service_item` reference **and** `frequency` at booking time, so the price seam resolves from explicit stored inputs (not fragile name-matching at charge time).

---

## 3. The features this breaks into (new/!updated backlog items)

Sequenced. Each is its own scoped piece; the first two are near-term foundations the rest depend on.

### F1 — Master-admin role (foundation, near-term) 🔑
Model master admin as a distinct role with **no `tenant_id`** (the existing `User.role` column already supports this — a `'master_admin'` role value with `tenant_id=NULL`, separate from tenants and end-users). A small `is_master_admin(user)` helper/decorator gates platform-level surfaces. This is the bedrock for everything platform-level (pricing CRUD, review queue, the platform area). **Replaces** the earlier `Tenant.is_platform_owner` stopgap idea — do it properly, minimally, now.

### F2 — Quick Book pricing catalog + frequency capture (this is #7) 🔴 launch-blocker
The unified service-item model (§2) + the Quick Book price rows + `resolve_price_for_job` implementation + frequency capture onto the Job. The thing that lets Quick Book actually transact. Sliced into increments (§4).

### F3 — Master-admin Quick Book item management UI
The master-admin section to create/list/edit Quick Book items "with all the bells and whistles" — an item-creation modal, the catalog list, activate/deactivate, set pricing mode + prices. Gated by F1. (This is a later increment of #7.)

### F4 — Tenant service-item creation + master-admin review queue
Providers add service items/categories via setup/business settings; items enter quote-only + `pending`; master admin reviews/approves/rejects before they go live. The moderation gate. Pre-launch necessity for a public marketplace.

### F5 — Service-discovery surface ("What services do you need?")
A call-to-action section on the landing page + client dashboard showing available services as tiles (Cleaning, Plumbing, Gardener, …). Fed by the approved/active items in the service-item model. Deliberately simple — a display surface, not a new engine.

### F6 — Master-admin platform area + privacy model
The master-admin's own dashboard and useful sections (catalog mgmt, analytics/insights, blog/content, the review queue); repurpose surfaces that don't apply (e.g. the calendar). **Plus** the privacy/permission model enforcing decision #6 — master admin cannot see tenants'/users' sensitive data. Larger; likely several increments. The role (F1) gates it; the privacy rules are a first-class requirement, not an afterthought.

### Relationship to existing backlog
- **#9 (identity/client model)** — F1 is the master-admin slice of the broader identity untangling; keep them aligned.
- **#16 (Quotes/Leads inbox-outbox restructure)** — unaffected, still valid.
- **R1 (two-sided vision)** — this note is the concrete platform-side expression of R1.

---

## 4. Re-sequencing increment 1 of #7

The earlier increment-1 plan deferred the master-admin gate and used a `Tenant.is_platform_owner` flag. Decision #1 changes that: master admin isn't a tenant, so that flag would embed the wrong model.

**Two ways to sequence — recommendation: 4A.**

**4A (recommended) — Establish the minimal master-admin role FIRST, then the pricing data model.**
Because everything platform-level hangs off the role, and the pricing CRUD UI (F3) is the very next thing that needs it, do a tiny **F1 increment first**: add the `'master_admin'` role value + `is_master_admin()` helper, set the seed's HQ user to that role (with `tenant_id=NULL`), no UI yet. *Then* the pricing data model increment (the unified item model + price rows + `resolve_price_for_job` + Job frequency capture) lands on correct bedrock. Two small, clean increments instead of one that bakes in a stopgap.

**4B — Pricing data model first, role just before the CRUD UI.**
Closer to the original plan: build the pricing tables now (no write API, so no gate needed yet), add the proper master-admin role in the increment that introduces the management UI. Defensible because increment 1 genuinely has no write surface — but it leaves the seed/HQ identity in the old "HQ tenant" shape a little longer.

> Recommendation: **4A.** It's barely more work, it retires the "HQ = tenant" remnant immediately, and it means the pricing model and everything after are built against the real role from the start. The cost is one extra tiny migration/seed change; the benefit is no stopgap to unwind.

**Proposed increment order for #7 + foundation:**
1. **F1 minimal master-admin role** — role value + helper + seed HQ as master_admin (`tenant_id=NULL`). Tiny migration/seed.
2. **Pricing data model** — unified service-item model + Quick Book price rows + `Job` frequency/item capture + `resolve_price_for_job` implementation + seed a few Quick Book items so the loop transacts in testing. (The original increment-1 backend foundation, on the new model.)
3. **F3 master-admin Quick Book item management UI** — create/list/edit, gated by F1.
4. **F5 discovery surface** + **F4 review queue** + **F6 platform area/privacy** — sequenced after, each scoped on its own.

---

## 5. Honest scope note

This meaningfully **grows the road to launch**. #7 alone was a launch-blocker; this note shows it brings a master-admin role, a review queue, a discovery surface, and a platform-area/privacy model with it. That's correct and necessary — these are real parts of a two-sided marketplace — but the path is longer than "just finish #7."

What's genuinely **pre-launch** vs **post-launch** is itself a decision worth making explicitly once this note is agreed:
- **Likely pre-launch:** F1 (role), F2 (pricing — the blocker), F4 (review queue — can't let providers publish unmoderated to a public marketplace), a basic F5 (discovery), and the core of F6's **privacy rules** (you must not expose sensitive data even in an MVP).
- **Can be leaner/post-launch:** the fuller F6 platform analytics/insights/blog tooling, the polished item-management UX, the with-inputs pricing mode.

The visual & UX overhaul phase (from the Status & Roadmap doc) still comes **after** these functional surfaces exist — build them functional-and-clean, style once at the end.

---

## 6. What to decide before building

1. **Confirm 4A vs 4B** (recommendation: 4A — minimal real master-admin role first).
2. **Confirm the unified-item model** (one flagged table) vs separate tables — to be finalised at the first schema increment, but lean unified.
3. **Confirm which features are pre-launch** (§5) so the sequence reflects the real launch bar.
4. Then: re-derive the **first increment's file-list plan** (F1 role) from this note, review the migration before `flask db upgrade`, build on the established discipline.
