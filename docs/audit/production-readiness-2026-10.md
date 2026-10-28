# AwaMenu — Production Readiness Audit

**Date:** 24 October 2026 · **Scope:** the whole codebase as of `main` at `9f756c9`, measured against `awamenu_spec.md` and `AwaMenu_Super_Admin.md`.
**Status:** pre-launch. Reservation concurrency and payment integrity have been fixed and verified against the production database (see §2). Everything else below is a finding with a recommended fix, waiting for a go-ahead.

---

## 1. Summary

The codebase is in better shape than most at this stage. There is an append-only payment ledger, claim-before-send emails, careful comments explaining *why*, and clear tenant scoping in queries. The serious problems are concentrated in four places:

1. **Payments could be confirmed wrongly, or not at all.** This is fixed. The Paystack webhook could never reach this app. Subscription and reservation charges were not amount-checked, so a ₦1 forged charge could grant a Pro plan. Orders paid through a restaurant's own keys or through Monnify could never be confirmed.
2. **Tables could be double-booked.** This is fixed and enforced by the database.
3. **Customer and staff endpoints that skip authentication.** This is **open, P0.** Unauthenticated server actions return customers' order history and home addresses, and let anyone act as staff (mark orders paid, approve bookings).
4. **The infrastructure plan won't survive real usage on free tiers.** This is open. Every open dashboard and order page re-renders on the server every 5 seconds, nothing is cached, and Vercel Hobby does not permit commercial use.

### Update — second pass (same day)

| Item | Status |
|---|---|
| **S1** customer data exposure | **Fixed.** OTP now issues a signed httpOnly customer session (`lib/customer-session.ts`). Hub, profile and checkout prefill take identity only from it. |
| **S2** staff actions without a session | **Fixed.** Every staff action requires a staff-dashboard session for that restaurant (`lib/staff-guard.ts`). The guard itself was also an exported server action; it moved to `lib/`. |
| **S3** OTP abuse | **Fixed.** Sends are capped at 3/15 min per recipient (DB-enforced) and 10/h per IP. Verifies are capped per IP+recipient, and the 5th wrong guess burns the code. Codes are stored as keyed hashes, one live code at a time, single-use. |
| **S4** staff login across IPs | **Fixed.** Added a per-restaurant cap (20 per 15 min). |
| **S5 (part)** rate-limit errors | **Fixed.** Limits now return a readable message, and fail open (with a Sentry report) if Redis is unreachable. Before, a Redis outage broke customer sign-in entirely. |
| **S6** staff session key and compare | **Fixed.** Purpose-scoped derived keys and a constant-time verify (`lib/signed-token.ts`). Existing staff sessions must sign in once. |
| **I2** 5-second polling | **Fixed.** Dashboards rely on the 15-s visibility-aware notification poll. Customer pages poll a version stamp (`/api/live/*`), refresh only on change, back off, and stop when finished. |
| **I3** no caching | **Fixed for the public menu.** It's cached per restaurant, purged on every menu-affecting save, with a 60-s ceiling (`lib/public-menu.ts`). |
| New: hidden reviews | **Open (P2).** `Rating.isHidden` isn't applied to restaurant analytics. |

Verified against the production database: OTP hashing, the burn-after-5 rule, single use, the send cap, session-gated hub, profile and lookup, sign-out, and staff actions refusing a real Staff ID without a session.

### Update: third pass

| Item | Status |
|---|---|
| **A1** maintenance mode | **Fixed.** `proxy.ts` serves a 503 maintenance page and refuses writes; payments, crons, sign-in and Super Admin keep working. |
| Hidden reviews | **Fixed.** Excluded from restaurant analytics and the platform average. |
| **S5** shared-Wi-Fi order limit | **Fixed.** Orders are limited per phone (10/h) with an IP ceiling of 150/h; reservations 5/h per phone, 40/h per IP. |
| **S7** platform Paystack key in plain text | **Fixed.** Encrypted at rest; production had no saved key to migrate. |
| **R1** paid tables without an online channel | **Fixed.** Refused at table save and at approval. |
| **R2** lost "add items" updates | **Fixed.** Atomic increments, conditional on the order still being open. |
| **R3** QR `301` and scan flooding | **Fixed.** `302`, and repeat scans from one device are counted at most 3 per 30 min. |
| Late payment on a cancelled order | **Fixed.** Flagged "Refund needed" on the order, and the owner is notified. |
| Super Admin "reset owner password" | **Built.** Sends a reset code and never sets a password. The owner reset flow was also hardened: crypto-random code, request and attempt limits, and all sessions signed out on reset. |
| CSP | **Added in report-only mode**, reporting to Sentry. Enforce after a clean period. |
| Dead dependencies | **Removed:** Stripe and the AWS S3 SDK. |
| U1, U2, U4, U7 | **Fixed.** "Booked for" label, readable payment states, "No payment needed" for free bookings, amber "awaiting payment". |
| Super Admin revenue | Added "Collected (30 days)" from the ledger; MRR relabelled "estimated". |

**Still open:**
- **Vercel Pro (I1):** your account action.
- **Delivery fees:** product decision.
- **Per-staff PIN.**
- **Enforcing the CSP:** after a clean report-only period.
- **Post-launch:** `prisma migrate`, and a queue for side effects.
- **Tests:** not added, by decision.

### Update: fourteenth pass (shared menu links)

| Area | Change |
|---|---|
| **Link previews** | Every restaurant now has a generated preview card (`app/(storefront)/[slug]/opengraph-image.tsx`, 1200×630): cover photo, or up to three dish photos (today's specials first), with logo, name, address and what you can do there, in Montserrat. Served as JPEG (~90–130 KB; WhatsApp drops large previews). Converted in pure JS (`pngjs` + `jpeg-js`) because `sharp` can't load inside Next's server bundle on Windows; any failure falls back to PNG with an `X-OG-Fallback` header and a Sentry report. |
| **Immediate refresh** | The card moved from Next's `opengraph-image` file to `/{slug}/share-image?v={version}`, where the version is a fingerprint of everything drawn on it (name, address, description, logo, cover, colour, dish photos, bookings, branding). Every relevant save purges the menu cache, so a change gives a new URL on the next page load; each version is cached permanently, old or unknown versions for 60 seconds. (It was cached for an hour.) |
| **Owner analytics: custom range** | Besides 7D/30D/90D/12M, a **Custom** from–to range (up to two years) with "This month" and "Last month" quick picks, compared with the same number of days just before. Every analytics query is now bounded at both ends, so a past range is exact. The CSV export follows the chosen range. Also: "Scans that ordered" no longer shows impossible rates (600%) when most orders came from links rather than QR scans. |
| **Titles and branding** | Titles lead with the restaurant ("Edis Bar · Menu"); "\| AwaMenu" only on plans that keep AwaMenu branding, and "Powered by AwaMenu" on the card likewise. Description from the restaurant's own text, or built from address and what it offers. Canonical URL, Open Graph and X tags, home-screen name. Private pages (cart, order, booking, rating, tracking) get the restaurant's title and `noindex` (they showed "AwaMenu — Restaurant Management"). `metadataBase` added so image URLs are absolute. |

### Update: thirteenth pass (Super Admin: analytics, pagination, restaurants, subscriptions, settings, commission)

Migration `9_platform_ops_commission`: per-restaurant commission override (+ note, date), commission rate and platform charge recorded on each payment attempt, offline-payment fields on subscription payments, and indexes for every list and platform-wide query.

| Area | Change |
|---|---|
| **A. Analytics** | Rebuilt as a business dashboard with tabs **Overview, Revenue, Growth, Marketplace, Traffic**; ranges 7D / 30D / 90D / 12M / All and a **custom date range**, bucketed by day, week or month, compared with the previous period, CSV export. Revenue: platform revenue by source, MRR history (from payments and current periods), take rate, MRR by plan. Growth: sign-ups, activation funnel (sign-up → verified → restaurant → menu → first order → paid plan), monthly retention cohorts, billing status. Marketplace: GMV/orders/active restaurants, order types, how customers paid (AwaMenu Pay share), platform heatmap, top restaurants. All aggregated in SQL (the old page loaded every order of six months into memory). |
| **PostHog** | **Traffic** tab reads PostHog via the HogQL query API (personal key, 10-minute cache): visitors, page views, sessions, product areas, top pages, referrers, devices, countries and key business events. Server events were never sent (they needed a key that wasn't set); now they use the project key, are flushed after the response, and `reservation_created` and `subscription_renewed` were added. **Owner action:** add `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, `POSTHOG_API_HOST` (see `.env.example`). |
| **B. Pagination** | Shared page-number pager (`lib/pagination.ts`, `components/ui/Pagination.tsx`) with page sizes, totals and URL state. Applied to Super Admin Accounts, Restaurants, Subscriptions, Payments, Reviews, Audit log, and the owner's Orders (was the latest 30 only, behind a fake pager), Reservations (latest 40) and Financials. Financials dates now use the restaurant's timezone. |
| **C. Restaurants** | Now an operations console: sales and orders (30 days, with trend), last order, dishes, payment set-up, rating, plan, billing and commission per restaurant; a **health** signal (active, slowing, quiet, inactive, no orders, no menu, getting started) with counts; filters, sorting, CSV export; ⋯ menu to open, view storefront, see subscription, email owner, set commission, suspend or restore. |
| **D. Subscriptions** | Correct MRR (monthly equivalent; quarterly/yearly were counted at the full monthly price, also fixed on the Overview), ARR, collected in 30 days vs the previous 30, renewals due, auto-renew coverage, at risk, churn, new paid, MRR by plan. Filters (state, plan, interval, auto-renew, search, sort) across all pages, CSV export. **Actions:** extend (free days), record an offline payment (bank transfer, cash or complimentary; starts the period, receipt email, on the owner's invoices), change plan, send the right reminder now, cancel auto-renew on Paystack. All audited. |
| **Billing fixes found** | One-off payers (no card) were treated as auto-renewing by the renewal cron: told "we'll charge your saved card" and never sent their 7/3-day warnings. Auto-renew is now "Paystack subscription and ACTIVE" everywhere (`isAutoRenewing`), so cancelling auto-renew also shows as off. |
| **E. Settings** | Logo is uploaded (signed Cloudinary, super admins only) instead of typed, and is used in the Super Admin header and AwaMenu's emails. Commission field shows a live breakdown on a ₦10,000 order; the old note ("only affects new subaccounts") was wrong and is replaced. Commission changes are audited with before and after. |
| **Commission** | Platform rate plus per-restaurant **custom** or **exempt** rates (`lib/commission.ts`), set from the Restaurants ⋯ menu or the restaurant page, with a reason. Applied per transaction for Paystack and now **Monnify** (whose split was fixed at connection time and recovered no provider fee). Each attempt records the rate charged; the ledger uses it. New **Commission** page: rates, overrides and an audit comparing expected commission with the provider's own split for every payment (Paystack `fees_split`), flagging mismatches. Verified on production: the existing AwaMenu Pay payment matched (rate 0%). |

### Update: twelfth pass (owner analytics as a BI dashboard)

| Area | Change |
|---|---|
| **Structure** | Analytics is now tabbed: **Overview, Sales, Menu, Customers, Operations, Bookings**, with ranges 7D / 30D / 90D / **12M** (weekly buckets on long ranges). Tab and range are kept in the URL. |
| **Charts** | Performance (bars vs dashed previous period), sales pace (cumulative), order mix donut, heatmap; sales by hour and weekday average; stacked sales by order type; order-value and basket-size histograms; payment-method donut; **menu performance matrix** (popularity vs price → Stars / Workhorses / Puzzles / Underperformers); sales by category; new vs returning customers; purchase-frequency histogram; top customers (phone masked); review breakdown; order funnel; cancellation reasons; kitchen load by hour; staff; bookings over time, outcome, booking hours and days, party size, lead time, per-table. |
| **Correctness** | Distributions are bucketed in SQL/server (no raw order lists sent to the browser). Deposits count only bookings the restaurant keeps. Compact money formatting is deterministic (Intl compact differed between server and browser and broke hydration). Chart colours: one emerald hue for magnitude; fixed per-entity categorical colours from a validated palette. |
| **Order speed** | **Built (migration `8_order_status_times`).** `Order` gains `confirmedAt`, `acceptedAt`, `preparingAt`, `readyAt`, `deliveredAt`, `completedAt`, stamped by a Postgres trigger on every status change (first time wins), so every code path is covered, including webhooks and crons. `acceptedAt` is set only when a person accepts an order that waited for approval. Analytics → Operations → **Speed**: median response, prep, delivery and pickup-wait times vs the previous period, prep-time histogram, prep by hour (slowest hour highlighted), by order type, and trend; also in the CSV. Durations over 4 hours are excluded as forgotten statuses. The order timeline now shows the real stage times and durations; it used to invent times (+1s, +2s) for every order. Older orders show only their placed time. Also adds an `Order(restaurantId, createdAt)` index for analytics. |

### Update: eleventh pass (emails and notifications)

| Area | Change |
|---|---|
| **"Restaurant got the guest's email"** | **Investigated.** In production the cancellation email went only to the guest's address. What the owner *did* get was an in-app notification and push about their own cancellation. Fixed by the rule below. |
| **Notification audience** | **One rule: tell the people who didn't act.** The owner's own actions (accept, status change, cancel, mark paid, approve, decline, cancel booking) now notify **staff**, not the owner; a staff member's actions notify the **owner**; guest and system events go to whoever must act. Status text is readable ("Out for delivery", not "OUT FOR_DELIVERY"). |
| **Notification UX** | Tapping a notification goes straight to the order or booking (the "Attend Task / Dismiss" step is gone). Refund alerts get their own amber icon instead of the green "payment received" one. Staff push notifications open the staff dashboard (they pointed at the owner dashboard, which staff can't open). Notifications older than 90 days are purged daily. |
| **Email templates** | **Rebuilt on React Email.** One design system (`emails/components.tsx`): header, card, details table, itemised receipt, callouts, code box, footer; plain-text part on every email. Replaces string-built HTML that inserted guest-typed names unescaped into owner emails, and plain-text-only emails for billing and bookings. |
| **Branding** | Guest emails (orders, bookings, sign-in codes) wear the restaurant's name, logo and colour, with replies going to the owner. Plans that remove AwaMenu branding show no AwaMenu name at all (sender "Edis Bar"); others say "Edis Bar via AwaMenu" and "Powered by AwaMenu" in the footer. Pale brand colours get dark text automatically. Emails to owners are AwaMenu-branded. The sending address stays on AwaMenu's domain (a restaurant hasn't verified theirs). |
| **Owner emails** | Added: a booking request needing approval, a guest cancelling (with any refund to handle). Removed: "order completed" to the owner (they or their staff just completed it). Renewal receipts link to Billing; grace-period wording matches the read-only lapse behaviour. |
| **Preview** | Super Admin → **Emails** shows every email with sample data, switchable between restaurant brand styles. |

### Update: tenth pass (owner billing, analytics, reservation cancellation)

| Area | Change |
|---|---|
| **Owner billing** | **Built.** Dashboard → Billing: current plan and state, next charge, outstanding payment with **Pay now**, payment history and printable invoices (`/billing/invoices/[id]`). The subscription card no longer claims auto-renew that doesn't exist. |
| **Owner analytics** | **Rebuilt as a business dashboard.** 7/30/90-day ranges in the restaurant timezone; KPI tiles with change vs the previous period and sparklines; a trend chart (Sales / Orders / Avg order) with the previous period dashed; plain-language insights (best day, peak hour, top dish share, unordered dishes, returning customers, scan-to-order, cancellations); heatmap, best sellers, order types, payments, reviews, staff. **Export CSV** (`/analytics/export`, formula-safe). |
| **Reservation cancellation** | **Rules defined.** The restaurant can cancel only **before** the booking time, with a reason the guest sees. If paid, a full refund is flagged as owed (and any paid pre-order too); the guest is told by email, SMS/WhatsApp (template `reservation_cancelled`) and on their booking page, which shows refund pending / refunded. **After** the booking time there's no cancel: **Mark as no-show** (frees the table), an optional **Flag refund** under the restaurant's own policy, and call/WhatsApp guest links; the guest page shows the restaurant's contact and cancellation policy. Who cancelled, when and why are recorded and audited. Migration `7_reservation_cancellation_details`. **Owner actions:** run the migration; get the `reservation_cancelled` WhatsApp template approved. |
| **Menu page / banner** | Plan-limit cards compacted for laptops; the banner Save button no longer clips. |

### Update: ninth pass (billing lapse, suspension, account data)

| Area | Change |
|---|---|
| **Login "invalid" for two owners** | **Investigated.** Neither account was suspended or blocked by billing (one is on active Pro until 2027). Passwords are intact and unchanged since August, so the passwords typed didn't match. The login now says so plainly and links to **Reset your password**; too many attempts get their own message. |
| **A. One billing rule** | `lib/billing-state.ts`, date-based, used everywhere. Fixed in production data: a Starter plan that ended 11 Sep kept working because its status still said ACTIVE. |
| **B. Billing ≠ admin suspension** | The cron no longer switches restaurants off; `isActive` is the Super Admin's alone, now with `suspensionReason`/`suspendedAt`. Migration `6_admin_suspension_reason` also turns back on any restaurant the old cron switched off. |
| **C. Lapsed owner** | Signs in, sees a red banner with one-tap **Pay and reactivate** and **Other options** (`/renew`); read-only, enforced server-side on every owner/staff/customer action (`lib/restaurant-access.ts`). The old full-screen "suspended, contact support" dead end is gone. Renewal after lapse starts on the payment date; early same-plan renewal extends from the end date. "You're back" email on reactivation. |
| **D. Customers** | Lapsed: view-only menu with "ordering paused" notice and phone; cart, checkout and bookings hidden and refused. Admin-suspended: "temporarily unavailable" page (no 404, not indexed). Order, booking and rating pages always work. |
| **E. Super Admin data in step** | Users → **Accounts** (owner + restaurants + billing + onboarding + sign-in + last active + data problems, with filters). Restaurants list and Subscriptions use the same billing states and badge admin suspensions separately. Restaurant detail is one place for subscription, payments, owner account and suspension (with a required reason). Overview flags lapsed restaurants and out-of-sync data. |


| Area | Change |
|---|---|
| **Ordering while closed** | **Fixed.** The menu said "Closed" but orders went through at any hour. Now the server refuses new orders outside opening hours, checkout shows why with the button disabled, and the menu shows a notice bar. Also fixed "next opening" for one-day-a-week schedules. |
| **Made-up figures** | **Removed.** The Orders page showed hard-coded "+12%" and "+8.2%" trends; the desktop menu labelled the first dish "Bestseller" and filled empty descriptions with "Freshly prepared." Trends are now real week-over-week comparisons; the badge is the owner's real "Today's special". |
| **Timezone** | **Fixed.** Owner "today", week, chart buckets and the Orders date filter used the server clock (UTC), an hour off Lagos. Now all in the restaurant's timezone (`lib/restaurant-day.ts`). |
| **Super Admin overview** | **Rebuilt:** needs-attention queue, 30-day KPIs with trends, subscriptions and plan mix, onboarding funnel, top and quiet restaurants, activity, system health with cron heartbeats. Subscriptions page filters by state. |
| **Owner overview** | **Rebuilt:** needs-attention list (now including staff without a PIN), today vs yesterday, real top sellers with photos, readable statuses. Orders page gains a refund filter and a visible filter chip. |
| **Dashboard chrome** | **Rebuilt for all three dashboards.** Super Admin Log out was at the bottom of a sidebar that couldn't scroll, so it was off-screen on most laptops, and there was no desktop header. Now: a header with an account menu everywhere; on mobile a native-style app bar, account sheet and full-width tab bar with safe-area padding. Also fixed: sidebar state read during render (hydration mismatch), the closed notification drawer's shadow showing on the screen edge, and duplicate mobile page headers (one with a dead button). |
| **Staff sold-out** | **Built.** Staff can mark dishes sold out / back in stock from the staff dashboard (Staff ID + PIN, audited). |
| **Storefront** | Search; dietary labels; "Today's special" finally shown (the flag existed but was never loaded); "Sold out today" that clears itself; details on desktop too. Migration `5_menu_item_sold_out_and_tags`. |


| Item | Status |
|---|---|
| **Super admin sent to plan selection** | **Fixed.** `/dashboard` sent anyone without a restaurant to `/onboarding/choose-plan`, and a super admin has no restaurant. Super admins now go to `/super-admin` from `/dashboard` and from every onboarding page. The session itself was fine. |
| **Per-staff PIN** | **Built.** Staff ID + private 4-digit PIN for every staff action. Owner-issued, shown once, keyed hash, database-backed lockout (5 wrong → 15 min), reset from the Staff page. Staff without a PIN are refused until the owner sets one. Migration `4_staff_pin_and_legal_documents`. **Owner action:** set a PIN for each existing staff member. |
| **Legal pages editable** | **Built.** Super Admin → Legal: company details and each page's text, with live preview, audit log and "restore built-in text". Public pages are cached and purged on save, and fall back to the built-in text if the database can't be read. |
| **Incident: production database wiped** | During this pass I generated a migration with Prisma's `--shadow-database-url` pointing at production. Prisma resets a shadow database, so production was emptied at about 16:48 UTC on 26 October. The owner restored it from Neon's point-in-time history. The restore point predates migration `3_restaurant_delivery_fee`, so 3 and 4 need re-applying. Migrations are now generated offline (schema file to schema file) and nothing passes a real database as a shadow. |


| Item | Status |
|---|---|
| **WhatsApp templates** | **Built.** Every business-initiated WhatsApp message (sign-in codes, order updates) now uses a Meta-approved template via Twilio's Content API. Before, free text was sent, which Twilio rejects outside the 24-hour window, so customers would have received nothing. Template texts: `docs/whatsapp-templates.md`. A type without an approved template isn't sent on WhatsApp; WhatsApp sign-in appears only once its template is approved. **Owner action:** create the templates, get them approved, set `TWILIO_WHATSAPP_TEMPLATES`. |
| **Privacy, Terms, Refund pages** | **Built.** `/privacy` (NDPA 2023: controller/processor roles, lawful bases, processors, cross-border transfers, retention, rights, NDPC complaints), `/terms`, `/refunds`. Linked from the footer (now also on mobile), owner signup and checkout. `refunds` added to reserved slugs. **Owner action:** fill in the company details (now in Super Admin → Legal, seventh pass) and have a lawyer review. |
| **Delivery fees** | **Built.** Delivery fees were always 0 (a restaurant couldn't charge for delivery). The restaurant sets a flat fee and an optional free-delivery minimum in **Settings → Ordering**, alongside the dine-in/pickup/delivery toggles. Computed on the server (`lib/delivery-fee.ts`) and stored on the order; checkout shows the same line. Migration `3_restaurant_delivery_fee`, deployed. |
| Per-staff PIN | Explained in this pass; **built in the seventh pass**. |

Verified: `tsc`, Biome and a production `next build` pass with no warnings.

### Update: fifth pass (role-by-role review)

I built an authorization matrix of every server action (which guard protects it, and whether it scopes to the caller's restaurant), then reviewed each role's features end to end.

| Role | Finding | Status |
|---|---|---|
| Customer | **Order and reservation links matched any ID suffix**, so `/{slug}/track/a` opened someone else's order. With guest cancellation that would have allowed cancelling strangers' bookings. | **Fixed.** Full ID or the exact 6-character code only, rate-limited, and ambiguous codes refused (`lib/tracking-code.ts`). |
| Customer | The confirmation email offered "View or cancel", but guests couldn't cancel. | **Built.** Guests can cancel until the booking starts. Paid bookings are flagged for refund under the restaurant's policy. |
| Owner | `updateMenuItemAction` didn't check the destination category, so an item could be moved into **another restaurant's** menu. | **Fixed** |
| Owner | Menu limits read `subscription.plan` directly, so a lapsed Pro plan kept unlimited creation. | **Fixed.** Uses the shared plan resolver. |
| Owner | Accepting an already-paid order sent it to `PENDING_PAYMENT`, where it was stuck. Concurrent accepts weren't guarded. | **Fixed** |
| Owner | Cancelling a paid order gave no prompt to refund it. | **Fixed.** Flagged "Refund needed"; a full refund clears it. |
| Owner | No way to clear a reservation refund flag after refunding by hand. | **Built.** "Mark as refunded", audited. |
| Owner | Slugs could be reserved words (`dashboard`, `login`, …), which made the storefront unreachable and `login`/`maintenance` bypassed maintenance mode. Renaming broke every printed QR code. | **Fixed.** Reserved list; old slugs redirect (`proxy.ts`) and can't be claimed by another restaurant. Migration `2_restaurant_previous_slugs`. |
| Staff | Acceptance skipped the per-type staff permission. | **Fixed** |
| Staff | Booking times shown in UTC (an hour off). No way to check guests in. | **Fixed.** Restaurant timezone; **Check in** for tonight's bookings (dine-in permission, audited). |
| Super Admin | Could suspend or delete super admins, **including themselves** (platform lockout). | **Fixed** |
| Super Admin | Errors ("Cannot delete a plan with subscriptions") were thrown, so the admin saw a generic error page. | **Fixed.** Shown inline (`ActionForm`/`ConfirmForm`). |
| Super Admin | "Change plan" didn't reset expiry notices, restore downgrade-hidden categories or lift an auto-suspension, and gave Free a 1-month expiry. | **Fixed** |
| All | Public-menu cache not purged on suspend or plan change. | **Fixed** |

Every remaining action was confirmed to scope by owner, staff session, customer session or super-admin role.

Verified:
- **Tests:** tracking-code rules and the old-slug redirects were run against the production database.
- **Build:** a production `next build` passes with no warnings.

Noted, not changed: owners can mark an unpaid pay-after-service order **completed**. That looks deliberate (comps, house accounts).

### Update: fourth pass ("after launch" items, done pre-launch)

| Item | Status |
|---|---|
| **Enforce the CSP** | **Done.** Enforced in production, report-only in development (Next's dev tooling needs `eval`). Violations report to Sentry. A production `next build` passes. |
| **`prisma migrate`** | **Done.** Baseline `0_init`, verified against production with an empty diff, includes the reservation exclusion constraint. It replaced `prisma/sql/reservation-integrity.sql` and `scripts/apply-db-constraints.ts`, both now deleted. Production is baselined; `1_outbox` was applied with `migrate deploy`, and `migrate status` reports up to date. The full history replays cleanly on an empty database. Migrations use `DIRECT_DATABASE_URL`, Neon's non-pooled host. Production Vercel builds run `migrate deploy` first (`scripts/vercel-build.mjs`); previews never migrate. `db:push` is removed. |
| **Side effects onto a queue** | **Done.** `OutboxJob` + `lib/outbox.ts`.<br>• **Queued:** lifecycle emails (order, reservation, billing), customer WhatsApp/SMS and Web Push are queued and sent after the response.<br>• **Failures:** retried with backoff by the payments cron; dead after 6 attempts, then reported.<br>• **Emails:** idempotent via Resend's idempotency key.<br>• **Codes:** sign-in and reset codes stay synchronous.<br>Verified on production: delivery, no double-send, backoff, dead-letter, and crash recovery. |
| Found along the way | **Fixed.** Web Push was an un-awaited promise (could be dropped when the function froze). Resend failures were never checked (it returns `{ error }`, it doesn't throw). |

### Priority list (as of the first pass)

| # | Priority | Finding | Effort |
|---|---|---|---|
| S1 | **P0** | Customer data exposed: `getCustomerHubDataAction`, `lookupCustomerByPhoneAction` and `updateCustomerProfileAction` need no authentication | M |
| S2 | **P0** | Staff server actions authenticate by staff ID only, with no session check: anyone can mark orders paid or approve bookings | S |
| S3 | **P0** | Customer OTP has no send limit (SMS pumping on Twilio) and no attempt limit (6-digit brute force) | S |
| I1 | **P0** | Vercel Hobby forbids commercial use; a paid SaaS must run on Pro | — |
| I2 | **P1** | 5-second `router.refresh()` polling on dashboards and order pages will exhaust function and database budgets | M |
| S4 | **P1** | Staff dashboard login is rate-limited per IP+slug, so the shared password (min 4 characters) can be guessed from many IPs | S |
| S5 | **P1** | Rate-limit failures surface as a generic server error; a limit of 5 orders/hour per IP blocks a whole restaurant on shared Wi-Fi | S |
| I3 | **P1** | No caching anywhere; the public menu (every QR scan) is fully server-rendered on each request | M |
| R1 | **P1** | Restaurants can configure paid tables without an online payment channel; guests then can't pay | S |
| S6 | **P2** | Staff session signature is compared non-constant-time, and its signing key is shared with better-auth | S |
| S7 | **P2** | Platform Paystack secret stored in plain text in `PlatformSetting` | S |
| R2 | **P2** | "Add items" updates order totals with read-then-write; concurrent additions lose one | S |
| R3 | **P2** | QR scan route returns `301`, which browsers cache, so repeat scans aren't counted; no rate limit protects the scan table | S |
| A1 | **P2** | No `proxy.ts`, no tenant cache, no maintenance-mode enforcement layer (spec §4) | M |
| A2 | **P2** | No tests; CI doesn't run `build` | M |
| U1–U8 | P2–P3 | UI/UX items in §7 | S each |

Effort: **S** < half a day · **M** 1–3 days.

---

## 2. Fixed in this pass (verified)

### 2.1 Reservation race conditions

**Problem.** Availability was checked *before* the write, in a separate step. Two guests booking the same table at the same moment both passed the check and both got the table. There were four further problems:
- Owner approval had the same race.
- Staff approval skipped the overlap check entirely.
- The public page showed only `ACTIVE` bookings as taken.
- The public page tested only whether the *start time* fell inside a booking, so 18:30 looked free before a 19:00 booking and was then refused at submit.

**Fix: three layers.**

1. **The database guarantees it.** A Postgres exclusion constraint makes overlapping holds on one table impossible, whatever the application does:
   ```sql
   EXCLUDE USING gist ("tableId" WITH =, tsrange("startsAt","expiresAt",'[)') WITH &&)
   WHERE (status IN ('APPROVED','ACTIVE','CHECKED_IN'))
   ```
   This is `prisma/sql/reservation-integrity.sql`, applied with `bun db:constraints`, which `bun db:push` now runs automatically. It is idempotent and checks for existing overlaps first. The losing write gets SQLSTATE `23P01`, which the app turns into "Sorry — someone just booked this table".
2. **One lifecycle module.** `lib/reservation-booking.ts` owns "what holds a table". Owner approval, staff approval, auto-confirm, payment, crons and the public page all use it.
3. **Every state change is a conditional update**: approve, decline, check-in, cancel and check-out. A decline can no longer overwrite a payment that landed a moment earlier, and a check-in can't revive a booking the no-show sweep just released.

**Verified on the production database:** 5 simultaneous inserts for the same table and slot gave **1 success and 4 clean refusals**, all recognised. Test data was removed.

### 2.2 Abandoned bookings: how long a table is held

| State | Holds the table? | Until |
|---|---|---|
| `PENDING_APPROVAL` (request) | **No.** An unpaid request costs nothing to make; letting it block a slot would let anyone lock every table. The constraint refuses the second of two competing approvals. | Expires when the booking time passes unanswered |
| `APPROVED`, payment due | **Yes** | `paymentDueAt` = approval time + the restaurant's **payment window** (default **2 hours**, configurable from 30 min to 24 h), never later than the booking itself |
| Guest presses **Pay** | Hold topped up to at least **15 minutes** | So the table can't be released mid-checkout |
| Window passes unpaid | **No.** It stops holding the instant the deadline passes, before any cron runs | Marked `EXPIRED`; guest and restaurant notified; unpaid pre-order cancelled |
| Pays *after* release | Reinstated **if the table is still free** (the constraint decides) | Otherwise flagged **"Refund needed"** to the restaurant, never silently kept |
| `ACTIVE` (confirmed) | Yes | Booking length + grace minutes, then a no-show expiry |

Correctness never depends on the cron's timing. A lapsed hold is treated as free in every availability query, and it is swept inline before any write that could collide with it.

Customer and owner UI changes:
- The status page shows "held until …", with an honest message once the hold is released.
- A new **"Approved — please pay by …"** email. Before this, approval sent nothing even though the request email promised it would.
- `APPROVED` now reads "Awaiting payment", not "Confirmed".
- Owners see the deadline and any "Refund needed" flag.

### 2.3 Payment integrity and idempotency

**Problems found:**
- **The webhook could never work.** Your Paystack account's one webhook URL belongs to another project. Separately, the signature was checked against `PAYSTACK_WEBHOOK_SECRET`, which differs from the secret key Paystack actually signs with.
- **No amount check** on subscription or reservation charges. Paystack transactions can be initialised by anyone holding the public key, with any amount and any metadata, and the result arrives correctly signed.
- **Subscriptions weren't idempotent.** Every webhook retry or reopened return link restarted the billing period from "now", which hands out free time.
- **Return-page verification always used the platform Paystack key.** Orders charged through a restaurant's own keys, or through Monnify or Flutterwave, could never be confirmed.
- **Reservation deposits went into AwaMenu's own Paystack balance** with no subaccount split. This is the "AwaMenu holds other people's money" situation the order code already refuses.
- **The webhook's onboarding branch cancelled *every* active subscription of the user**, so onboarding a second restaurant cancelled the first one's plan.
- **`resolveRefundCredentials`, `listCheckoutGateways` and `resolveCheckoutGateway` returned decrypted gateway secret keys** from a `"use server"` file. That makes them server actions a browser can invoke.

**Fix: webhook-independent payment attempts** (`lib/payment-attempts.ts`, new `PaymentAttempt` table):

1. Before redirecting to any provider, the app records an attempt with **its own reference `AWM-ORD|RSV|SUB-…`** plus `metadata.app = "awamenu"`. It stores what the charge is for, the amount, the gateway and whose keys. That makes AwaMenu's payments identifiable on the shared Paystack account.
2. Settlement comes from whichever signal arrives first. All are safe together because settlement is exactly-once:
   - the customer's **return page**
   - **`/api/cron/payments`** (every 5 minutes), which verifies pending attempts by reference with back-off for up to 24 hours. This catches customers who paid and closed the tab.
   - the **webhook**, if the other project ever forwards AwaMenu-tagged events (see §2.4)
3. **What a charge is *for* comes from the attempt row, never from metadata.** Amount and currency are checked before anything is credited.
4. Per type:
   - **Orders:** the existing ledger (`creditOrder`, unique per gateway and reference).
   - **Reservations:** `lib/reservation-payments.ts`. One conditional claim; replays recognised; double payments, payments on declined or cancelled bookings, and late payments on resold tables are all flagged for refund.
   - **Subscriptions:** a new append-only **`SubscriptionPayment` ledger**, unique per gateway and reference, in `lib/subscription-payments.ts`. The Super Admin **Payments** page now shows these real charges rather than plan list prices.
5. Reservations now route through the restaurant's own payment channel, exactly like orders.
6. Credential-returning functions moved to `lib/payment-routing.ts`, a plain server module a browser can't call.
7. Reconciliation (`/api/cron/reconcile-payments`) now pages through the shared account and judges only AwaMenu-tagged transactions.

**Verified on the production database:**

| Scenario | Result |
|---|---|
| ₦1 paid on a ₦50 deposit | Refused, flagged |
| Full payment | Confirmed |
| Same charge replayed | Recognised, no-op |
| Second charge on a paid booking | Refund flagged |
| 3 simultaneous settlements of one charge | Exactly one confirmation |
| Lapsed hold, paid late, table free | Reinstated |
| Lapsed hold, paid late, table resold | Refund flagged; the new booking untouched |
| Payment on a declined request | Refund flagged |
| Forged ₦1 Starter subscription | Refused, nothing granted |
| 3 simultaneous settlements of one subscription | One ledger row, one subscription |
| Reopened return link | Billing period unchanged |

### 2.4 Optional: real-time confirmation via the other project

If you can add about five lines to the other project's Paystack webhook handler, AwaMenu confirms payments instantly instead of within about 5 minutes:

```ts
// In the OTHER project's Paystack webhook, before its own handling:
if (event.data?.metadata?.app === "awamenu") {
  await fetch("https://awamenu.com/api/webhooks/paystack", {
    method: "POST",
    headers: { "content-type": "application/json", "x-paystack-signature": signature },
    body: rawBody, // forward the exact raw body, unchanged
  });
  return new Response("ok");
}
```

The signature stays valid because both apps share the same secret key. AwaMenu's webhook acts only on references it created and ignores everything else.

### 2.5 Other fixes made along the way

- **Timezone.** Bookings were read in the server's timezone (UTC on Vercel). A 19:00 Lagos booking was stored an hour late, and the confirmation email told the guest **20:00**. All booking times now use the restaurant's timezone (`lib/zoned-time.ts`), and the customer page, emails and availability grid agree.
- **Blackout dates.** The date regex had lost its backslashes (`/^d{4}-…/`), so **no closure date could ever be saved**.
- **Auto-confirmed free bookings** were left on `APPROVED`, where they never became active or expired.
- **Public tables page** loaded every `ACTIVE` booking ever made. It now loads future holding bookings only.
- **Return URLs** kept `?reference=` while the page polled every 5 seconds, which re-verified each time. They now redirect to a clean URL after verifying.

### 2.6 Operational steps for you

1. **Restart `bun dev`.** Then run `bunx prisma generate`; the running dev server held the engine file locked during this work.
2. **Set up cron-job.org.** Every job sends the header `Authorization: Bearer <CRON_SECRET>`.

   | URL | Schedule |
   |---|---|
   | `GET /api/cron/payments` | every 5 min |
   | `GET /api/cron/reservations` | every 10 min |
   | `GET /api/cron/subscriptions` | daily |
   | `GET /api/cron/reconcile-payments` | daily, 01:00 |
3. **`PAYSTACK_WEBHOOK_SECRET`:** leave it unset, or set it equal to `PAYSTACK_SECRET_KEY`.
4. **QStash is now optional.** The reservations cron covers no-show expiry.

---

## 3. Security findings (open)

### S1 · P0 · Unauthenticated customer data access
`actions/customer.actions.ts`. Server actions are public POST endpoints, and these three trust whatever identifier they are given:

- `getCustomerHubDataAction({ identifier })` returns up to 50 orders across **all** restaurants (names, items, totals) plus reservations, for any phone number or email. The OTP flow calls it, but nothing stops a direct call.
- `lookupCustomerByPhoneAction({ phone })` returns the customer's **name, email and home delivery address**. Iterating phone numbers is doxxing.
- `updateCustomerProfileAction({ identifier, … })` overwrites any customer's profile, including the delivery address.

This is a likely Nigeria Data Protection Act 2023 issue as well as a security one.

**Fix:**
- On successful OTP, issue a signed, httpOnly **customer session** cookie (same pattern as `lib/staff-auth.ts`, separate key, about 30 days).
- Have hub and profile actions read the identity *from the session*, never from input.
- Reduce phone lookup to returning nothing (or a first name only) unless the session matches.

### S2 · P0 · Staff actions authenticate by staff ID alone
`verifyStaffAction(slug, staffId)` in `actions/staff.actions.ts` never checks the staff session cookie. The staff dashboard *page* is guarded, but these actions are reachable without it:
- `recordDineInPaymentAction` (marks orders paid, writes the ledger)
- `staffUpdateOrderStatusAction`
- `staffApproveReservationAction`

All they need is a 6-character staff ID, which ex-staff know.

**Fix:**
- Require `getStaffSession()` with `session.restaurantId === restaurant.id` inside `verifyStaffAction`. This is a few lines.
- Longer term, add the **per-staff PIN** the spec describes (§12), so attribution can't be spoofed by someone who simply knows a colleague's ID.

### S3 · P0 · Customer OTP abuse
- `requestCustomerOtpAction` has no rate limit. Anyone can trigger unlimited SMS or WhatsApp sends to any number, and "SMS pumping" fraud runs up the Twilio bill.
- `verifyCustomerOtpAction` has no attempt limit. A 6-digit code valid for 10 minutes can be brute-forced with parallel requests.
- Codes are stored in plain text.

**Fix:**
- Rate-limit sends per identifier (e.g. 3 per 15 min) and per IP.
- Allow at most 5 verify attempts per code, then invalidate it.
- Store `sha256(code + identifier)`.
- Add Turnstile on the send step.

### S4 · P1 · Staff dashboard password is guessable
- The comment says attempts are capped per restaurant, but the key is `${ip}:${slug}`, so rotating IPs gives unlimited guesses.
- The minimum length is 4.

**Fix:** a per-slug limit (in addition to per-IP), a minimum of 8 characters, and an owner alert after repeated failures.

### S5 · P1 · Rate limiting behaviour
- **Generic errors.** `enforceRateLimit` throws a plain `Error`. `actionResult` rethrows it as a production digest, so customers see "Something went wrong" rather than "Too many requests". It should throw `ActionError`.
- **Shared Wi-Fi.** Orders are limited to 5/hour per **IP + slug**. A full restaurant on its own Wi-Fi shares one IP, so the sixth table to order is refused. Key on IP + phone number with a higher IP ceiling (e.g. 60/hour), and rely on Turnstile for bots.
- **Fails open.** If Upstash is down or unset, all limits silently disappear. Acceptable for availability, but log it.

### S6 · P2 · Staff session details
- **Non-constant-time comparison.** `sig !== expectedSig` should use `timingSafeEqual`.
- **Shared signing key.** The cookie is signed with `BETTER_AUTH_SECRET`, so a leak of one compromises both. Use a dedicated `STAFF_SESSION_SECRET`.
- **No revocation.** Rotating the staff password doesn't end existing sessions. Include a password version in the payload.

### S7 · P2 · Plain-text platform secret
`PlatformSetting.paystackSecretKey` is stored unencrypted, unlike restaurant keys. Encrypt it with `lib/secret-box.ts`, or drop it and keep the key only in the environment.

### Also checked (fine)
- Order prices and totals are computed server-side from the database.
- Uploads are owner-scoped and signed.
- Notification access re-derives the recipient from the session.
- Security headers are sensible (CSP intentionally deferred; worth adding in report-only mode first).
- Owner sessions use a 5-minute cookie cache with a live suspension check.
- better-auth rate limiting is database-backed with strict rules on credential endpoints.

---

## 4. Architecture review

**What's solid:**
- **Clear layering:** actions, lib, Prisma.
- **Payments:** the gateway adapter interface is the right abstraction, and the append-only financial ledger is correct.
- **Explicit domain decisions:** booking rules live on tables, and policy is snapshotted at booking time.
- **Comments** explain intent and trade-offs.
- **Polling over SSE** was the correct call for Vercel.

**Gaps against a professional baseline:**

- **A1 · Missing proxy layer.** The spec's `proxy.ts` (tenant resolution, rate limiting, maintenance mode) was never built. That's fine to defer, but **maintenance mode** in `PlatformSetting` has no enforcement point. Add a small `proxy.ts` that reads a cached maintenance flag and short-circuits storefront and dashboard routes.
- **A2 · No automated tests, and CI skips `build`.** The highest-value tests are the ones this audit ran by hand: concurrent booking, settlement scenarios, subscription replay. Turn them into a Vitest suite against a Neon branch or Testcontainers Postgres, and add `bun run build` to CI.
- **No migrations.** `db push` is fine pre-launch. After launch, switch to `prisma migrate` so schema changes are reviewed, ordered and reversible. The exclusion constraint then goes in a migration's SQL.
- **`"use server"` hygiene.** Every export of a `"use server"` file is a public endpoint. Adopt a rule: those files export only actions that authenticate their caller first, and helpers live in `lib/`. A lint check (grep in CI) can enforce it. S1 and S2 are both this class of bug.
- **Monolithic action files.** `order.actions.ts` (956 lines) and `reservation.actions.ts` mix validation, authorisation, business rules and side effects. The new `lib/reservation-booking.ts` shows the target shape: thin actions that authenticate, then call a domain module.
- **Spec drift.** The spec still describes SSE, Twilio-only payments and Cloudinary-only storage. Update it, or mark sections superseded, so it stays the source of truth it claims to be.

---

## 5. Infrastructure and cost

### I1 · P0 · Vercel Hobby is non-commercial
Vercel's Hobby plan terms restrict it to personal, non-commercial use. A SaaS taking subscription payments needs **Pro** (about $20/month per member). Budget for it at launch. Pro also brings longer function durations and higher limits, which several cron jobs benefit from.

### I2 · P1 · Polling cost
| Poller | Interval | Cost per refresh |
|---|---|---|
| `AdminOrdersPoller` (orders page) | 5 s | Full RSC render of a `force-dynamic` page + DB queries |
| `OrderStatusPoller` (customer order page) | 5 s | Same |
| `ReservationStatusPoller` | 5 s | Same |
| Notification hook (dashboard shell) | 15 s | Query |

One restaurant with one dashboard open for a 12-hour service makes roughly **8,600 server renders a day** from the orders page alone. Each open customer order page adds 720 per hour. This drives three costs: function invocations and active CPU, Neon compute (the database **never suspends** while anything polls), and Fra1 egress.

**Fix:**
- Poll a tiny JSON endpoint, e.g. `GET /api/orders/changes?since=<ts>` returning `{ changed: boolean }` from an indexed `updatedAt` query, and call `router.refresh()` only when something changed.
- Stop polling while `document.hidden`.
- Back off to 15–30 s on customer pages, and stop entirely once the order is terminal.

Expect a 90%+ cut in server renders.

### I3 · P1 · Caching
Nothing uses `"use cache"`, `unstable_cache` or `revalidateTag`. The public menu, the page every QR scan lands on, is rendered dynamically because it reads `searchParams`.

**Fix:**
- Cache the menu data per restaurant: `cacheTag("menu:" + restaurantId)`, revalidated in menu, branding and settings actions.
- Move the `?orderId=` handling to a small client component so the page itself can be static or ISR.
- Cache plan lists and platform settings similarly.

Menu traffic then costs CDN hits instead of database queries.

### Free-tier pressure points (verify current limits before launch)
- **Neon:** compute-hour allowance. Polling and frequent crons keep compute awake. Fix I2 first, then decide between Neon Launch and staying on free.
- **Upstash Redis:** now used only for rate limits, so it's cheap. QStash is now optional.
- **Resend:** 3,000 emails per month on free. Reservation and order lifecycles send several emails each, so watch usage.
- **Twilio:** every WhatsApp/SMS is paid. S3 is a cost risk as well as a security one.
- **Region:** functions run in `fra1` next to Neon (good). For Nigerian users the main latency is the client-to-Frankfurt round trip; caching (I3) is the lever.

---

## 6. Reliability and data consistency (open)

- **R1 · P1 · Paid tables without online payment.** A table can be configured `DEPOSIT_REQUIRED`/`FULL_PAYMENT` while the restaurant has no online channel. Guests get approved, can't pay, and the hold expires. Block saving such a table, or show a setup warning, unless an online channel is enabled.
- **R2 · P2 · Lost order-total updates.** "Add items" (`order.actions.ts` around line 301) reads the total and writes the sum. Use `{ increment }` updates inside the same transaction as the item insert.
- **R3 · P2 · QR scan counting.** The QR route returns `301`, which browsers cache, so repeat scans from one phone aren't counted. Use `302`. Add a cheap per-IP limit so a bot can't fill the `ScanEvent` table (Neon storage).
- **Late order payments.** A payment that lands after an order was **cancelled** is credited, but nobody is told to refund it. Mirror the reservation refund flag on orders.
- **Delivery fee hardcoded to 0.** `order.actions.ts` line 274. It's a product gap; ensure the UI doesn't promise one.
- **Side effects are inline.** Emails and notifications run in the request after the database commit. Failures are caught, but a timeout extends the customer's wait. Post-launch, move them to a queue (QStash publish, or a `NotificationOutbox` table drained by cron).
- **Backups.** Confirm Neon point-in-time restore is enabled on the production branch and do one test restore before launch.

---

## 7. UI/UX observations

| # | Where | Observation |
|---|---|---|
| U1 | Owner reservation modal | "Requested on {startsAt}" shows the **booking** time, not the request time. Use `createdAt`, or relabel it "Booked for". |
| U2 | Customer reservation page | Payment status shows the raw enum (`PENDING`, `PAID`). Use guest-friendly words. |
| U3 | Rate limits (S5) | A limited customer sees a generic error page. |
| U4 | Free bookings | They store `reservationPaymentStatus = PAID` with ₦0, so receipts read "PAID". Add a `NOT_REQUIRED` state, or hide payment for free bookings. |
| U5 | Order/reservation pages | Pages "flash" on 5-second full refreshes. The change-polling in I2 fixes this too. |
| U6 | Table settings | No warning when a paid table has no online payments (R1). |
| U7 | Customer reservation status colours | `APPROVED` (awaiting payment) still uses the green "confirmed" style; it should be amber. |
| U8 | Accessibility | Spot checks only. Run an axe/Lighthouse pass on the storefront at 375 px before launch (spec §25, Phase 11). |

---

## 8. Recommended order of work

1. **This week (launch blockers):** S1, S2, S3, then I1 (move to Pro). After that, set up the cron jobs in §2.6.
2. **Before marketing pushes traffic:** I2 (change-polling), I3 (menu caching), S4, S5, R1.
3. **First month after launch:** A2 (tests and CI build), the switch to `prisma migrate`, R2, R3, the late-payment refund flag on orders, S6, S7, UI items.
4. **Ongoing:** the queue for side effects, the per-staff PIN, a CSP in report-only mode, a spec refresh.

---

## Appendix A · Files changed in the fix pass

- **New**
  - `lib/`:
    - `reservation-booking.ts`
    - `reservation-payments.ts`
    - `subscription-payments.ts`
    - `payment-attempts.ts`
    - `payment-routing.ts`
    - `zoned-time.ts`
  - `prisma/sql/reservation-integrity.sql`
  - `scripts/apply-db-constraints.ts`
  - `app/api/cron/payments`
  - `app/api/cron/reservations`
- **Schema**
  - `Reservation`: `paymentDueAt`, `refundRequiredReason`, `approvedEmailSentAt`, plus new indexes
  - `ReservationSetting.paymentWindowMinutes`
  - New models `SubscriptionPayment` and `PaymentAttempt`
- **Rewritten**
  - The Paystack and QStash webhooks
  - `lib/payments.ts`
  - Reservation approve/decline/pay/check-in/cancel/check-out
  - Staff approval
- **Updated**
  - Public tables page and reservation flow (timezone, range overlap)
  - Reservation status page
  - Owner reservations list
  - Reservation settings (payment window)
  - Super Admin payments page
  - Gateway adapters (currency and fee on verify)
  - Reconciliation cron
  - `.env.example`
