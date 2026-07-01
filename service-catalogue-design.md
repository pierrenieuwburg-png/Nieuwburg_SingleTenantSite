# Service Catalogue Design — SA Home Services Marketplace

## The Shared Skeleton

Almost every booking form on a platform like this is answering the same five underlying questions, just in a different order and with different labels: **what** do you need done, **how much of it** (time/quantity), **how often**, **anything extra**, and **what does it cost now**. Because that skeleton repeats, the interface layer should be built once as a small toolkit of input components, and each service is really just a *configuration* of that toolkit — a different combination of tile options, a different stepper range, a different frequency set — rather than a bespoke form. The running price bar at the bottom is a rendering concern (sum of the pricing rules triggered by the current answers), not a new component per service.

## The Reusable Question-Type Toolkit

Five core types cover the quick-bookable catalogue. A sixth is worth adding specifically for the quote-request path, since quoting depends on things a client can show more easily than describe.

| # | Type | What it captures | Example uses |
|---|---|---|---|
| 1 | **Tile-Grid Multi-Select** | The specific tasks/extras wanted, visually, multiple selections allowed | "What would you like done?" (dusting, fridge inside, windows), extras add-ons |
| 2 | **Segmented Single-Select** (chips or dropdown) | One choice from a small closed set | Home size band, frequency, urgency level |
| 3 | **Number Stepper** | A continuous quantity, usually hours | "How many hours?", "How many sessions?" |
| 4 | **Quantity Counter** | A discrete count per category, often several side by side | Bedrooms, bathrooms, windows, appliances |
| 5 | **Yes/No Toggle** | A binary condition or add-on that affects price or logistics | Booking cover, pets on-site, parking available, own equipment provided |
| 6 | **Photo/Note Upload** *(quote path only)* | Visual scope reference plus free-text context | "Show us the area/damage", "Add any notes for the provider" |

Everything below is written as a configuration of these six types — no service should need a component that isn't on this list.

---

## List A — Quick-Bookable Services

These are priced by a rule engine the instant the client finishes answering, so every question here must map cleanly onto something with a known cost driver: time, size band, or countable extras.

### 1. Indoor House Cleaning
**One-line:** Standard or deep clean of a home, recurring or once-off.
**Pricing model:** Frequency-based with a recurring discount tier, layered on an hours-based core (home size sets a default hour estimate, which the client can adjust).
- *Why:* Cleaning time scales predictably with home size, and providers reward standing bookings with lower per-visit rates — the two most common levers competitors already use.

| Order | Question | Type |
|---|---|---|
| 1 | How big is your home? (studio / 1–2 bed / 3–4 bed / 5+ bed) | Segmented Single-Select |
| 2 | What would you like done? (kitchen, bathrooms, bedrooms, fridge inside, oven, windows, ironing) | Tile-Grid Multi-Select |
| 3 | How many hours would you like booked? | Number Stepper |
| 4 | How often? (once-off / weekly / bi-weekly / monthly) | Segmented Single-Select |
| 5 | Booking cover (guaranteed replacement if provider cancels)? | Yes/No Toggle |
| 6 | Do you have pets at home? | Yes/No Toggle |

**Price-affecting factors:** Home size sets base hours; extras in the tile-grid add fixed per-item amounts; hours stepper overrides/extends the base; recurring frequency applies a discount tier; booking cover adds a flat fee.

---

### 2. Office / Small Commercial Cleaning
**One-line:** Recurring cleaning for small offices, shops, or studios.
**Pricing model:** Frequency-based, hours-driven — floor area substitutes for "home size."
- *Why:* Same logic as domestic cleaning, but the size band is measured in square metres/desks rather than bedrooms since commercial spaces don't map to residential bands.

| Order | Question | Type |
|---|---|---|
| 1 | How large is the space? (small office <100m² / medium 100–300m² / large 300m²+) | Segmented Single-Select |
| 2 | What would you like done? (floors, kitchenette, bathrooms, bins, windows, desks) | Tile-Grid Multi-Select |
| 3 | How many hours per visit? | Number Stepper |
| 4 | How often? (once-off / weekly / bi-weekly / monthly) | Segmented Single-Select |
| 5 | Is cleaning required after hours? | Yes/No Toggle |

**Price-affecting factors:** Space band sets base hours; after-hours adds a surcharge; extras add fixed amounts; frequency sets the discount tier.

---

### 3. Laundry & Ironing
**One-line:** Wash, dry, and/or iron a load of household laundry.
**Pricing model:** Hours-based, with a load-count quantity counter as the main cost driver rather than home size.
- *Why:* Unlike whole-home cleaning, laundry cost tracks volume of washing, not property size.

| Order | Question | Type |
|---|---|---|
| 1 | How many loads of laundry? | Quantity Counter |
| 2 | What would you like done? (wash & dry, ironing only, fold & pack away) | Tile-Grid Multi-Select |
| 3 | How many hours would you like booked? | Number Stepper |
| 4 | How often? (once-off / weekly / bi-weekly) | Segmented Single-Select |

**Price-affecting factors:** Load count sets base hours; ironing/folding extras add fixed amounts; frequency applies discount tier.

---

### 4. Babysitting / Childcare
**One-line:** In-home supervision and care for children, hourly.
**Pricing model:** Hours-based, with the number-of-children counter as a multiplier rather than a size band.
- *Why:* Effort scales with number and age of children more than with anything resembling "home size," so the defining question shifts to a counter instead of a segmented select.

| Order | Question | Type |
|---|---|---|
| 1 | How many children? | Quantity Counter |
| 2 | What are their ages? (infant / toddler / school-age / teen — select all that apply) | Tile-Grid Multi-Select |
| 3 | What's included? (meal prep, homework help, bath time, school pickup) | Tile-Grid Multi-Select |
| 4 | How many hours would you like booked? | Number Stepper |
| 5 | How often? (once-off / weekly / recurring) | Segmented Single-Select |
| 6 | Booking cover? | Yes/No Toggle |

**Price-affecting factors:** Number of children raises the per-hour rate; hours stepper is the main multiplier; included tasks add small fixed amounts; frequency sets discount tier.

---

### 5. Elderly / Companion Care
**One-line:** Non-medical companionship and daily-living support for an elderly family member.
**Pricing model:** Hours-based, with a care-level select in place of a size band.
- *Why:* Cost tracks the level of assistance required (companionship vs. mobility/personal care support) rather than any physical size measure.

| Order | Question | Type |
|---|---|---|
| 1 | What level of care is needed? (companionship only / help with daily tasks / mobility support) | Segmented Single-Select |
| 2 | What would you like included? (meal prep, light housekeeping, medication reminders, transport to appointments) | Tile-Grid Multi-Select |
| 3 | How many hours would you like booked? | Number Stepper |
| 4 | How often? (once-off / weekly / recurring) | Segmented Single-Select |
| 5 | Booking cover? | Yes/No Toggle |

**Price-affecting factors:** Care level sets the base hourly rate; included tasks add fixed amounts; hours stepper multiplies; frequency sets discount tier.

---

### 6. Garden Maintenance
**One-line:** Routine mowing, edging, and tidying of an existing garden.
**Pricing model:** Frequency-based, with garden size as the defining question.
- *Why:* Recurring upkeep is the norm (grass grows back), so this mirrors the cleaning model closely, with garden size replacing home size.

| Order | Question | Type |
|---|---|---|
| 1 | How big is your garden? (small / medium / large) | Segmented Single-Select |
| 2 | What would you like done? (mow lawn, edge borders, weed beds, hedge trim, leaf/green waste removal) | Tile-Grid Multi-Select |
| 3 | How many hours would you like booked? | Number Stepper |
| 4 | How often? (once-off / bi-weekly / monthly) | Segmented Single-Select |
| 5 | Is green waste removal needed? | Yes/No Toggle |

**Price-affecting factors:** Garden size sets base hours; extras add fixed amounts; green waste removal adds a flat surcharge; frequency sets discount tier.

---

### 7. Pool Cleaning & Maintenance
**One-line:** Routine chemical balancing, netting, and filter checks for a home pool.
**Pricing model:** Frequency-based, flat per-visit rate driven by pool size.
- *Why:* Pool servicing is a fairly standardised routine once pool size and type are known, making it a clean flat-rate-per-visit model rather than open-ended hours.

| Order | Question | Type |
|---|---|---|
| 1 | What size is your pool? (small / medium / large) | Segmented Single-Select |
| 2 | What would you like included? (net & vacuum, chemical balancing, filter check, equipment check) | Tile-Grid Multi-Select |
| 3 | How often? (weekly / bi-weekly / monthly) | Segmented Single-Select |
| 4 | Do you need chemicals supplied? | Yes/No Toggle |

**Price-affecting factors:** Pool size sets the base per-visit rate; extras add fixed amounts; supplied chemicals add a consumables fee; frequency sets discount tier.

---

### 8. Pet Sitting / Dog Walking
**One-line:** Walks, feeding, and check-ins for pets while owners are away or at work.
**Pricing model:** Hours-based for sitting; flat one-off for a single walk — a service where two sub-models coexist under one toolkit configuration.
- *Why:* Walking is a fixed-duration, fixed-price unit; sitting scales with hours, so both fit the standard toolkit without a bespoke form.

| Order | Question | Type |
|---|---|---|
| 1 | What service do you need? (dog walk / home visit & feed / overnight sit) | Segmented Single-Select |
| 2 | How many pets? | Quantity Counter |
| 3 | How many hours (for sitting) or how long is the walk? | Number Stepper |
| 4 | How often? (once-off / weekly / recurring) | Segmented Single-Select |

**Price-affecting factors:** Service type sets the base rate structure (flat vs. hourly); pet count adds a per-pet surcharge; hours/duration multiplies for sitting; frequency sets discount tier.

---

### 9. Move-In / Move-Out Deep Clean
**One-line:** A thorough one-off clean of an empty or near-empty property before/after moving.
**Pricing model:** One-off flat, priced off home size rather than hours — clients don't want to have to guess hours for a job they've never done before.
- *Why:* This is inherently a once-off job with a fairly predictable scope once size is known, so a flat quote-free price removes friction better than an hours stepper would.

| Order | Question | Type |
|---|---|---|
| 1 | How big is the property? (studio / 1–2 bed / 3–4 bed / 5+ bed) | Segmented Single-Select |
| 2 | What would you like done? (inside cupboards, inside oven/fridge, windows, walls spot-clean, garage) | Tile-Grid Multi-Select |
| 3 | Is the property empty or still furnished? | Segmented Single-Select |
| 4 | What date do you need this completed by? | Segmented Single-Select (date/urgency band) |

**Price-affecting factors:** Property size sets the flat base price; extras add fixed amounts; furnished status adjusts base (furnished takes longer to work around); tight timelines may add a rush surcharge.

---

### 10. Window Cleaning
**One-line:** Interior and/or exterior window cleaning for a home.
**Pricing model:** One-off flat, priced by window count — a small, easily countable job that doesn't need an hours stepper at all.
- *Why:* Window count is a near-perfect proxy for time and effort, so pricing directly off the counter is more transparent to the client than an hours estimate.

| Order | Question | Type |
|---|---|---|
| 1 | How many windows? | Quantity Counter |
| 2 | Interior, exterior, or both? | Segmented Single-Select |
| 3 | Any hard-to-reach windows (upper floors, skylights)? | Yes/No Toggle |
| 4 | How often? (once-off / quarterly / bi-annually) | Segmented Single-Select |

**Price-affecting factors:** Window count sets the base price per unit; interior+both adds a multiplier over interior-only; hard-to-reach access adds a flat surcharge; recurring frequency sets discount tier.

---

## List B — Quote-Requestable Services

These jobs vary too much by site condition, materials, and existing damage/state for any fixed formula to hold — the platform's job here is to collect enough scope, quantity, and access detail that a provider can quote accurately without a wasted site visit.

### 1. Plumbing Repairs
**Why quote-only:** The same symptom ("leaking pipe") can mean a five-minute fix or a wall-opening job depending on what's behind the surface — cost depends on cause, not just task name.

| Order | Question | Type |
|---|---|---|
| 1 | What's the issue? (leak, blockage, burst pipe, geyser, installation, other) | Tile-Grid Multi-Select |
| 2 | Where is it located? (kitchen, bathroom, outdoor, geyser room, whole house) | Tile-Grid Multi-Select |
| 3 | How urgent is this? (emergency — today / this week / flexible) | Segmented Single-Select |
| 4 | Photos/notes of the issue | Photo/Note Upload |
| 5 | Is water currently shut off? | Yes/No Toggle |

---

### 2. Electrical Work
**Why quote-only:** Scope ranges from a single socket swap to full rewiring, and safety/compliance requirements (COC certificates) shift the job entirely — no flat rate can cover that spread responsibly.

| Order | Question | Type |
|---|---|---|
| 1 | What do you need? (new installation, repair, fault-finding, compliance certificate, load shedding backup) | Tile-Grid Multi-Select |
| 2 | How many points/fixtures are involved? | Quantity Counter |
| 3 | How urgent is this? (emergency / this week / flexible) | Segmented Single-Select |
| 4 | Photos/notes of the area or issue | Photo/Note Upload |
| 5 | Is the property's DB board accessible? | Yes/No Toggle |

---

### 3. Interior/Exterior Painting
**Why quote-only:** Price depends on surface area, wall condition (prep needed), paint quality, and number of coats — none of which can be assumed from a room count alone.

| Order | Question | Type |
|---|---|---|
| 1 | What needs painting? (interior walls, exterior walls, ceilings, trim/doors, fencing) | Tile-Grid Multi-Select |
| 2 | How many rooms or approximate area? | Quantity Counter |
| 3 | What's the current wall condition? (good / needs minor prep / needs major prep or repairs) | Segmented Single-Select |
| 4 | Do you have a paint preference/brand, or should the provider recommend? | Yes/No Toggle |
| 5 | Photos of the space | Photo/Note Upload |
| 6 | When would you like this done? | Segmented Single-Select |

---

### 4. General Handyman & Repairs
**Why quote-only:** This category is deliberately a grab-bag of small, unrelated tasks — the whole point is flexibility, which is the opposite of standardisable pricing.

| Order | Question | Type |
|---|---|---|
| 1 | What needs doing? (free text task list, plus common tiles: shelving, curtain rails, door/lock fix, furniture assembly, general odd jobs) | Tile-Grid Multi-Select |
| 2 | Roughly how many separate tasks? | Quantity Counter |
| 3 | Do you have the materials, or should the provider bring them? | Yes/No Toggle |
| 4 | Photos/notes of the tasks | Photo/Note Upload |
| 5 | How urgent is this? | Segmented Single-Select |

---

### 5. Roofing Repair & Waterproofing
**Why quote-only:** Roof access, pitch, material type, and extent of damage vary hugely and materially change both risk and labour — this is the archetypal "needs an assessment" job.

| Order | Question | Type |
|---|---|---|
| 1 | What's the issue? (leak, damaged tiles/sheeting, waterproofing, gutter repair, full re-roof) | Tile-Grid Multi-Select |
| 2 | What is the roof made of? (tile, IBR/corrugated sheet, flat concrete/waterproofed, thatch, unsure) | Segmented Single-Select |
| 3 | Approximate roof size or number of storeys | Segmented Single-Select |
| 4 | How urgent is this? (active leak / this week / flexible) | Segmented Single-Select |
| 5 | Photos of the damage/area | Photo/Note Upload |

---

### 6. Tiling
**Why quote-only:** Cost depends on surface area, tile size/pattern complexity, and whether old tiles must be removed first — details that vary job to job.

| Order | Question | Type |
|---|---|---|
| 1 | What's being tiled? (floor, wall, splashback, bathroom) | Tile-Grid Multi-Select |
| 2 | Approximate area (m²) | Quantity Counter |
| 3 | Is there existing tile to remove first? | Yes/No Toggle |
| 4 | Do you have tiles already, or need the provider to source them? | Yes/No Toggle |
| 5 | Photos of the space | Photo/Note Upload |
| 6 | When would you like this done? | Segmented Single-Select |

---

### 7. Carpentry & Built-In Furniture
**Why quote-only:** Custom cupboards, shelving, and fitted furniture are bespoke by nature — dimensions, material, and design vary per client and can't be pre-priced.

| Order | Question | Type |
|---|---|---|
| 1 | What do you need built? (built-in cupboards, shelving, kitchen units, custom furniture, repair) | Tile-Grid Multi-Select |
| 2 | Approximate dimensions/area | Quantity Counter |
| 3 | Preferred material (wood, MDF/board, unsure — ask provider) | Segmented Single-Select |
| 4 | Photos or reference images of the desired look | Photo/Note Upload |
| 5 | When would you like this done? | Segmented Single-Select |

---

### 8. Appliance Repair
**Why quote-only:** Cause of failure (and whether it's even worth repairing vs. replacing) can't be known without diagnosis, so cost genuinely can't be fixed upfront.

| Order | Question | Type |
|---|---|---|
| 1 | What appliance needs repair? (washing machine, fridge, oven/stove, dishwasher, tumble dryer, other) | Tile-Grid Multi-Select |
| 2 | Brand and approximate age of appliance | Segmented Single-Select |
| 3 | What's the fault? (not turning on, not heating/cooling, leaking, making noise, other) | Tile-Grid Multi-Select |
| 4 | How urgent is this? | Segmented Single-Select |
| 5 | Photos/notes of the appliance and fault | Photo/Note Upload |

---

### 9. Renovations & Small Building Work
**Why quote-only:** By definition this spans everything from a bathroom refresh to a room extension — the widest possible scope range on the platform, requiring a full site assessment.

| Order | Question | Type |
|---|---|---|
| 1 | What kind of project is this? (kitchen renovation, bathroom renovation, room addition, wall removal/structural, other) | Tile-Grid Multi-Select |
| 2 | Approximate area affected | Quantity Counter |
| 3 | Do you have building plans/approval already, or is that needed? | Yes/No Toggle |
| 4 | Photos of the current space | Photo/Note Upload |
| 5 | What's your target timeline? | Segmented Single-Select |

---

### 10. Landscaping & Garden Redesign
**Why quote-only:** Distinct from routine garden maintenance (List A) — this is design-and-build work where plant choice, hardscaping, and layout are bespoke to the site and the client's taste.

| Order | Question | Type |
|---|---|---|
| 1 | What's the scope? (full redesign, new planting, paving/hardscaping, irrigation, lawn installation) | Tile-Grid Multi-Select |
| 2 | Approximate garden size | Segmented Single-Select |
| 3 | Do you have a design in mind, or need design input? | Yes/No Toggle |
| 4 | Photos of the current garden | Photo/Note Upload |
| 5 | What's your target timeline? | Segmented Single-Select |

---

### 11. Pest Control
**Why quote-only:** Treatment method and number of visits depend on infestation type and severity, which can't be reliably self-diagnosed by the client at booking time.

| Order | Question | Type |
|---|---|---|
| 1 | What pest is the issue? (ants, cockroaches, rodents, termites, bed bugs, other/unsure) | Tile-Grid Multi-Select |
| 2 | Where is it affecting? (kitchen, whole house, garden/exterior, roof space) | Tile-Grid Multi-Select |
| 3 | How severe would you say it is? (occasional sighting / regular problem / infestation) | Segmented Single-Select |
| 4 | How urgent is this? | Segmented Single-Select |
| 5 | Photos/notes if available | Photo/Note Upload |

---

### 12. Moving & Relocation
**Why quote-only:** Price depends on volume of belongings, floor access (stairs/lifts), and distance — none of which reduce to a clean size band the way a cleaning job does.

| Order | Question | Type |
|---|---|---|
| 1 | What size move is this? (studio / 1–2 bed / 3–4 bed / office) | Segmented Single-Select |
| 2 | Pickup and drop-off addresses (for distance) | Segmented Single-Select (address entry) |
| 3 | Any stairs or no-lift access at either end? | Yes/No Toggle |
| 4 | Do you need packing help, or just transport? | Tile-Grid Multi-Select |
| 5 | Any large/special items? (piano, safe, appliances) | Tile-Grid Multi-Select |
| 6 | Preferred moving date | Segmented Single-Select |

---

## Summary Table — Pricing Model at a Glance

| Service | List | Pricing model |
|---|---|---|
| Indoor House Cleaning | A | Frequency + hours-based |
| Office Cleaning | A | Frequency + hours-based |
| Laundry & Ironing | A | Hours-based |
| Babysitting/Childcare | A | Hours-based |
| Elderly/Companion Care | A | Hours-based |
| Garden Maintenance | A | Frequency-based |
| Pool Cleaning | A | Frequency-based, flat per visit |
| Pet Sitting/Dog Walking | A | Hours-based / flat per walk |
| Move-In/Move-Out Clean | A | One-off flat |
| Window Cleaning | A | One-off flat |
| Plumbing | B | Quote |
| Electrical | B | Quote |
| Painting | B | Quote |
| General Handyman | B | Quote |
| Roofing/Waterproofing | B | Quote |
| Tiling | B | Quote |
| Carpentry/Built-Ins | B | Quote |
| Appliance Repair | B | Quote |
| Renovations | B | Quote |
| Landscaping/Redesign | B | Quote |
| Pest Control | B | Quote |
| Moving/Relocation | B | Quote |
