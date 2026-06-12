# AwaMenu — Restaurant Multi-Tenant Platform Specification

> **Version:** 4.2.0  
> **Status:** MVP Planning  
> **Runtime:** Bun · Next.js 16 · TypeScript 5  
> **Target:** Mobile-first, PWA, zero-cost infrastructure for MVP  
> **Landing Page UI/UX Reference:** menurite.app

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Core Concept & Multi-Tenancy](#2-core-concept--multi-tenancy)
3. [Tech Stack](#3-tech-stack)
4. [System Architecture](#4-system-architecture)
5. [Project Structure](#5-project-structure)
6. [Database Schema](#6-database-schema)
7. [Subscription Plans](#7-subscription-plans)
8. [Restaurant Onboarding Flow](#8-restaurant-onboarding-flow)
9. [Feature Specification](#9-feature-specification)
10. [In-App Notification System](#10-in-app-notification-system)
11. [PWA Configuration](#11-pwa-configuration)
12. [Staff Management & Order Attribution](#12-staff-management--order-attribution)
13. [Rating System](#13-rating-system)
14. [API Design](#14-api-design)
15. [Security Model](#15-security-model)
16. [Payment Integration](#16-payment-integration)
17. [WhatsApp Integration](#17-whatsapp-integration)
18. [Mobile-First UI/UX Strategy](#18-mobile-first-uiux-strategy)
19. [Error Tracking & Observability](#19-error-tracking--observability)
20. [Project Setup & Commands](#20-project-setup--commands)
21. [Development Workflow](#21-development-workflow)
22. [Environment Variables](#22-environment-variables)
23. [Deployment Strategy](#23-deployment-strategy)
24. [Zero-Cost Infrastructure Breakdown](#24-zero-cost-infrastructure-breakdown)
25. [Phase Plan — Full Build](#25-phase-plan--full-build)
26. [Future Roadmap](#26-future-roadmap)
27. [Coding Standards & Conventions](#27-coding-standards--conventions)

---

## 1. Project Overview

**AwaMenu** is a multi-tenant SaaS platform that enables restaurants to have a fully functional digital presence — including a branded menu page, QR code generation, online ordering, dine-in management, table reservations, WhatsApp order notifications, in-app push notifications, staff management, and an admin dashboard — all without needing their own domain or hosting.

**Landing page UI/UX is designed referencing menurite.app.**

**The core value proposition:** A restaurant owner visits awamenu.com, chooses a subscription plan, pays online, and immediately gets:

- A live customer-facing menu at `awamenu.com/burgerpalace`
- A downloadable/printable QR code pointing to that URL
- An admin dashboard to manage everything
- Online payment collection from their customers
- WhatsApp + in-app push notifications for every new order
- Staff accounts and order attribution
- A fully installable PWA for admin and staff

**Customers never need to sign up or create an account.** They scan a QR code, browse the menu, order, and pay — entirely anonymously. Customer identity is captured at checkout via name + phone only.

**Platform super-admin** can manage the entire system: all tenants, subscription plans, billing, and platform settings.

---

## 2. Core Concept & Multi-Tenancy

### Tenancy Strategy: Path-Based Routing

We use **path-based multi-tenancy** (`awamenu.com/[slug]`).

**Why path-based:**
- Works immediately on Vercel free tier — no wildcard SSL needed
- No DNS configuration per tenant
- Custom domains can be layered on later via Cloudflare Workers (post-MVP)

### URL Map

```
awamenu.com/                    → Marketing landing page (UI ref: menurite.app)
awamenu.com/pricing             → Pricing plans page
awamenu.com/signup              → Restaurant owner account creation
awamenu.com/login               → Restaurant owner login
awamenu.com/onboarding/*        → Post-signup onboarding steps
awamenu.com/dashboard/[slug]/*  → Restaurant admin dashboard (protected)
awamenu.com/staff/[slug]        → Staff login + order management (protected, staff role)
awamenu.com/super-admin/*       → Platform super-admin panel (protected, SUPER_ADMIN role)
awamenu.com/[slug]              → Public customer menu (no login required)
awamenu.com/[slug]/cart         → Cart & checkout (no login required)
awamenu.com/[slug]/tables       → Table reservation (no login required)
awamenu.com/[slug]/order/[id]   → Order status tracking (no login required)
awamenu.com/[slug]/rate/[id]    → Post-service rating page (no login required)
awamenu.com/[slug]/reservation/[id] → Reservation status page (no login required)
```

### Tenant Isolation

- Every Prisma query scoped by `restaurantId`
- PostgreSQL RLS as a second layer
- Redis cache keys namespaced `tenant:{restaurantId}:*`
- R2 assets under `restaurants/{restaurantId}/...`
- Plan limits enforced in server actions before every write

---

## 3. Tech Stack

### Core

| Layer | Technology | Reason |
|---|---|---|
| Framework | Next.js 16 (App Router) | RSC, proxy.ts, Turbopack |
| Runtime | Bun | Fast installs, native TS |
| Language | TypeScript 5 (strict) | Type safety critical for payments |
| Styling | Tailwind CSS v4 | JIT-only |
| Components | shadcn/ui | Headless, accessible |
| State (client) | Zustand | Cart, UI state, notification store |
| State (server) | TanStack Query v5 | Server state, polling |

### Backend & Data

| Layer | Technology | Reason |
|---|---|---|
| ORM | Prisma 6 + Prisma Accelerate | Type-safe, connection pooling |
| Database | Neon (PostgreSQL) | Serverless, free tier |
| Cache / Sessions | Upstash Redis | Serverless Redis |
| File Storage | Cloudflare R2 | 10GB free, no egress fees |
| Background Jobs | Upstash QStash | Serverless queues |
| Real-time | Upstash Redis pub/sub + SSE | In-app notifications (zero cost) |

### Auth & Security

| Layer | Technology | Reason |
|---|---|---|
| Auth | better-auth | Modern, Prisma adapter |
| Bot Protection | Cloudflare Turnstile | Free CAPTCHA |
| Rate Limiting | Upstash Ratelimit | Per-route, per-tenant |
| Input Validation | Zod | Runtime + compile-time |
| Server Actions | next-safe-action | Type-safe with Zod |
| Env Validation | t3-env | Build-time validation |

### PWA & Notifications

| Layer | Technology | Reason |
|---|---|---|
| PWA | next-pwa (serwist) | Service worker, install prompt, offline |
| Web Push | web-push (VAPID) | Native push to installed PWA |
| In-app real-time | SSE via `/api/notifications/stream/[restaurantId]` | Zero-cost live feed |

### Integrations

| Service | Technology | Purpose |
|---|---|---|
| Payments | Paystack (primary) · Stripe (secondary) | Subscription billing + customer orders |
| Email | Resend + React Email | Transactional emails |
| WhatsApp | Twilio WhatsApp API | Order notifications to restaurant |
| QR Codes | qrcode.react + sharp | Generation + branded download |
| Error Tracking | Sentry | Full-stack monitoring |
| Analytics | Posthog | Product analytics |

---

## 4. System Architecture

```
┌──────────────────────────────────────────────────────────┐
│              Cloudflare Edge (Free Tier)                  │
│   WAF · DDoS · Turnstile · CDN · R2 · Bot rules          │
└────────────────────────┬─────────────────────────────────┘
                         │
┌────────────────────────▼─────────────────────────────────┐
│           Next.js 16 App (Vercel Free Tier)               │
│                                                           │
│  proxy.ts (Node.js runtime)                               │
│  ├── Extracts slug from path                              │
│  ├── Resolves tenant from Redis / Neon                    │
│  ├── Injects x-tenant-id, x-tenant-slug headers          │
│  └── Rate limiting via Upstash Ratelimit                  │
│                                                           │
│  App Router                                               │
│  ├── (marketing)/          Landing + Pricing              │
│  ├── (auth)/               Signup / Login                 │
│  ├── (onboarding)/         Restaurant setup flow          │
│  ├── (dashboard)/[slug]/   Restaurant admin               │
│  ├── (staff)/[slug]/       Staff order interface          │
│  ├── (super-admin)/        Platform super-admin           │
│  └── [slug]/               Public customer menu           │
│                                                           │
│  Route Handlers (/api/*)                                  │
│  ├── /api/webhooks/paystack                               │
│  ├── /api/webhooks/qstash                                 │
│  ├── /api/qr/[slug]                                       │
│  ├── /api/whatsapp/notify                                 │
│  ├── /api/notifications/stream/[restaurantId]  ← SSE     │
│  ├── /api/notifications/push/subscribe         ← VAPID   │
│  └── /api/notifications/push/unsubscribe                  │
└──────────┬──────────────────────┬────────────────────────┘
           │                      │
┌──────────▼──────┐  ┌────────────▼──────────────────────┐
│  Neon Postgres  │  │  Upstash Redis                     │
│  + Prisma ORM   │  │  Sessions · Cart · Rate limits     │
│  + RLS policies │  │  Pub/sub channels · Push subs      │
└─────────────────┘  └────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────────┐
│  External Services                                        │
│  Paystack · Stripe · Resend · QStash · Sentry            │
│  Posthog · Cloudflare R2 · Twilio WhatsApp               │
└──────────────────────────────────────────────────────────┘
```

### proxy.ts

```typescript
// app/proxy.ts
import { type NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export default async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  const segments = pathname.split('/').filter(Boolean)
  const potentialSlug = segments[0]

  const systemRoutes = [
    'dashboard', 'login', 'signup', 'api', '_next',
    'favicon.ico', 'onboarding', 'pricing', 'super-admin', 'staff',
  ]
  if (!potentialSlug || systemRoutes.includes(potentialSlug)) {
    return NextResponse.next()
  }

  const cacheKey = `tenant:slug:${potentialSlug}`
  let tenantId = await redis.get<string>(cacheKey)

  if (!tenantId) {
    const { db } = await import('@/lib/db')
    const restaurant = await db.restaurant.findUnique({
      where: { slug: potentialSlug, isActive: true },
      select: { id: true },
    })
    if (!restaurant) return NextResponse.next()
    tenantId = restaurant.id
    await redis.setex(cacheKey, 300, tenantId)
  }

  const response = NextResponse.next()
  response.headers.set('x-tenant-id', tenantId)
  response.headers.set('x-tenant-slug', potentialSlug)
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

## 5. Project Structure

```
.
├── app/
│   ├── proxy.ts
│   ├── layout.tsx
│   ├── not-found.tsx
│   │
│   ├── (marketing)/
│   │   ├── page.tsx
│   │   ├── pricing/page.tsx
│   │   └── about/page.tsx
│   │
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   ├── signup/page.tsx
│   │   └── layout.tsx
│   │
│   ├── (onboarding)/
│   │   ├── layout.tsx
│   │   ├── choose-plan/page.tsx
│   │   ├── checkout/page.tsx
│   │   └── setup/page.tsx
│   │
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   └── dashboard/[slug]/
│   │       ├── page.tsx
│   │       ├── menu/page.tsx
│   │       ├── menu/[itemId]/page.tsx
│   │       ├── tables/page.tsx
│   │       ├── orders/page.tsx
│   │       ├── reservations/page.tsx
│   │       ├── staff/page.tsx
│   │       ├── settings/page.tsx
│   │       └── analytics/page.tsx
│   │
│   ├── (staff)/
│   │   ├── layout.tsx
│   │   └── staff/[slug]/
│   │       ├── login/page.tsx
│   │       └── page.tsx
│   │
│   ├── (super-admin)/
│   │   ├── layout.tsx
│   │   └── super-admin/
│   │       ├── page.tsx
│   │       ├── restaurants/page.tsx
│   │       ├── restaurants/[id]/page.tsx
│   │       ├── plans/page.tsx
│   │       ├── plans/[id]/page.tsx
│   │       └── users/page.tsx
│   │
│   ├── [slug]/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── cart/page.tsx
│   │   ├── tables/page.tsx
│   │   ├── order/[orderId]/page.tsx
│   │   ├── reservation/[reservationId]/page.tsx
│   │   └── rate/[orderId]/page.tsx
│   │
│   └── api/
│       ├── auth/[...all]/
│       ├── webhooks/
│       │   ├── paystack/route.ts
│       │   └── qstash/route.ts
│       ├── qr/[slug]/route.ts
│       ├── upload/route.ts
│       ├── whatsapp/notify/route.ts
│       └── notifications/
│           ├── stream/[restaurantId]/route.ts   # SSE endpoint
│           ├── push/subscribe/route.ts          # Save VAPID push subscription
│           └── push/unsubscribe/route.ts        # Remove push subscription
│
├── components/
│   ├── ui/
│   ├── marketing/
│   │   ├── PricingSection.tsx
│   │   ├── PricingCard.tsx
│   │   └── FeatureComparison.tsx
│   ├── onboarding/
│   │   ├── PlanSelector.tsx
│   │   ├── OnboardingProgress.tsx
│   │   └── RestaurantSetupForm.tsx
│   ├── menu/
│   │   ├── MenuPage.tsx
│   │   ├── CategoryNav.tsx
│   │   ├── MenuSection.tsx
│   │   ├── MenuItemCard.tsx
│   │   ├── CartDrawer.tsx
│   │   └── CartItem.tsx
│   ├── checkout/
│   │   ├── CheckoutFlow.tsx
│   │   ├── OrderTypeStep.tsx
│   │   ├── DineInStep.tsx
│   │   ├── TableReservationStep.tsx
│   │   ├── ReservationPreOrderStep.tsx
│   │   ├── ReservationPaymentStep.tsx
│   │   ├── DeliveryStep.tsx
│   │   ├── CustomerDetailsStep.tsx
│   │   └── PaymentStep.tsx
│   ├── reservation/
│   │   ├── TableGrid.tsx
│   │   ├── TableCard.tsx
│   │   └── ReservationStatusPage.tsx
│   ├── staff/
│   │   ├── StaffOrderFeed.tsx
│   │   ├── DineInPaymentModal.tsx
│   │   └── StaffOrderCard.tsx
│   ├── admin/
│   │   ├── MenuEditor.tsx
│   │   ├── CategoryManager.tsx
│   │   ├── OrdersPanel.tsx
│   │   ├── TableManager.tsx
│   │   ├── ReservationSettingForm.tsx
│   │   ├── ReservationManager.tsx
│   │   ├── StaffManager.tsx
│   │   ├── QRDownload.tsx
│   │   ├── AnalyticsDashboard.tsx
│   │   └── PlanLimitBanner.tsx
│   ├── notifications/
│   │   ├── NotificationBell.tsx         # Bell icon + unread badge for admin/staff nav
│   │   ├── NotificationDrawer.tsx       # Slide-in panel listing all notifications
│   │   ├── NotificationItem.tsx         # Single notification row
│   │   ├── PushPermissionPrompt.tsx     # "Enable notifications" banner
│   │   └── InstallPWAPrompt.tsx         # "Add to home screen" banner
│   ├── super-admin/
│   │   ├── RestaurantTable.tsx
│   │   ├── PlanEditor.tsx
│   │   └── PlatformStats.tsx
│   ├── rating/
│   │   └── RatingForm.tsx
│   └── shared/
│       ├── BottomNav.tsx
│       ├── RestaurantHeader.tsx
│       └── OrderStatusBadge.tsx
│
├── lib/
│   ├── db.ts
│   ├── redis.ts
│   ├── auth.ts
│   ├── staff-auth.ts
│   ├── payments.ts
│   ├── qr.ts
│   ├── r2.ts
│   ├── qstash.ts
│   ├── email.ts
│   ├── whatsapp.ts
│   ├── ratelimit.ts
│   ├── plan-limits.ts
│   ├── staff-id.ts
│   ├── reservation-policy.ts
│   ├── notifications.ts                 # Dispatch helper (SSE pub + Web Push send)
│   ├── web-push.ts                      # VAPID send logic
│   └── validations/
│       ├── menu.ts
│       ├── order.ts
│       ├── reservation.ts
│       ├── plan.ts
│       └── rating.ts
│
├── actions/
│   ├── menu.actions.ts
│   ├── order.actions.ts
│   ├── reservation.actions.ts
│   ├── restaurant.actions.ts
│   ├── onboarding.actions.ts
│   ├── staff.actions.ts
│   ├── rating.actions.ts
│   ├── notification.actions.ts
│   └── super-admin.actions.ts
│
├── stores/
│   ├── cart.store.ts
│   ├── ui.store.ts
│   └── notification.store.ts            # Zustand: unread count, in-memory list
│
├── hooks/
│   ├── useCart.ts
│   ├── useTenant.ts
│   ├── usePlanLimits.ts
│   ├── useTableAvailability.ts
│   ├── useNotificationStream.ts         # SSE connection hook
│   └── usePushSubscription.ts           # VAPID subscribe/unsubscribe hook
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── migrations/
│
├── emails/
│   ├── OrderConfirmation.tsx
│   ├── RestaurantWelcome.tsx
│   ├── SubscriptionConfirmation.tsx
│   └── ReservationConfirmation.tsx
│
├── public/
│   ├── manifest.webmanifest             # PWA manifest
│   ├── sw.js                            # Service worker (generated by serwist)
│   ├── icons/                           # PWA icons (192, 384, 512px)
│   │   ├── icon-192.png
│   │   ├── icon-384.png
│   │   ├── icon-512.png
│   │   └── icon-maskable-512.png
│   └── qr-frame/
│
├── env.ts
├── biome.json
├── next.config.ts                       # includes serwist PWA config
├── tailwind.config.ts
└── sentry.config.ts
```

---

## 6. Database Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL")
}

// ─── Enums ────────────────────────────────────────────

enum UserRole {
  RESTAURANT_OWNER
  SUPER_ADMIN
}

enum PlanTier {
  FREE
  STARTER
  PRO
}

enum SubscriptionStatus {
  ACTIVE
  PAST_DUE
  CANCELLED
  TRIALING
}

enum OnboardingStatus {
  PENDING_PLAN
  PENDING_PAYMENT
  PENDING_SETUP
  COMPLETE
}

enum OrderType {
  DINE_IN
  PICKUP
  DELIVERY
  TABLE_RESERVATION
}

enum OrderStatus {
  PENDING_PAYMENT
  CONFIRMED
  PREPARING
  READY
  DELIVERED
  COMPLETED
  CANCELLED
}

enum PaymentStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}

enum DineInPaymentMethod {
  CASH
  TRANSFER_OR_CARD
}

enum PaymentPolicy {
  PAY_BEFORE_SERVICE
  PAY_AFTER_SERVICE
}

enum ReservationStatus {
  ACTIVE
  CHECKED_IN
  EXPIRED
  CANCELLED
}

// ─── Table Booking Configuration Enums ───────────────

enum TableBookingMode {
  FREE_BOOKING
  ORDER_REQUIRED
  DEPOSIT_REQUIRED
  FULL_PAYMENT
}

enum TablePaymentTiming {
  PAY_ON_BOOKING
  PAY_ON_ARRIVAL
  PAY_AFTER_SERVICE
}

enum TableInclusionType {
  TABLE_FEE_ONLY
  FOOD_ONLY
  FOOD_AND_TABLE_FEE
}

enum RatingContext {
  DINE_IN
  DELIVERY
  PICKUP
  RESERVATION
}

// ─── Notification Enums ───────────────────────────────

// Who the notification is for
enum NotificationAudience {
  ADMIN   // Restaurant owner / dashboard users
  STAFF   // Staff members of the restaurant
  BOTH    // Sent to both admin and staff
}

// What triggered the notification
enum NotificationType {
  NEW_ORDER              // A new order was placed (any type)
  ORDER_STATUS_CHANGED   // Admin/staff updated an order's status
  ORDER_CANCELLED        // An order was cancelled
  NEW_RESERVATION        // A customer booked a table
  RESERVATION_CANCELLED  // A reservation was cancelled
  RESERVATION_EXPIRED    // QStash fired expiry — table freed
  PAYMENT_RECEIVED       // Staff recorded a dine-in payment
  LOW_STOCK_ALERT        // (future) menu item stock low
}

// ─── Auth (better-auth managed) ──────────────────────

model User {
  id            String       @id @default(cuid())
  email         String       @unique
  emailVerified Boolean      @default(false)
  name          String?
  image         String?
  role          UserRole     @default(RESTAURANT_OWNER)

  onboardingStatus OnboardingStatus @default(PENDING_PLAN)

  restaurants        Restaurant[]
  sessions           Session[]
  accounts           Account[]
  subscriptions      Subscription[]
  pushSubscriptions  PushSubscription[]  // VAPID Web Push subscriptions

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Account {
  id           String  @id @default(cuid())
  userId       String
  user         User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider     String
  providerId   String
  accessToken  String?
  refreshToken String?
  idToken      String?

  @@unique([provider, providerId])
}

// ─── Staff Accounts ───────────────────────────────────

model StaffMember {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)

  name         String
  staffId      String     @unique
  pinHash      String
  isActive     Boolean    @default(true)

  orders            Order[]            @relation("AttendingStaff")
  pushSubscriptions PushSubscription[] // VAPID Web Push subscriptions for staff

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([restaurantId])
  @@index([staffId])
}

// ─── Subscription Plans ───────────────────────────────

model Plan {
  id          String   @id @default(cuid())
  tier        PlanTier @unique
  name        String
  description String?

  monthlyPrice Decimal @db.Decimal(10, 2) @default(0)
  yearlyPrice  Decimal @db.Decimal(10, 2) @default(0)

  maxCategories Int @default(2)
  maxMenuItems  Int @default(8)

  multipleTemplates        Boolean  @default(false)
  advancedAnalytics        Boolean  @default(false)
  removeAwamenuBranding    Boolean  @default(false)
  whatsappIntegration      Boolean  @default(true)
  prioritySupport          Boolean  @default(false)
  basicSupport             Boolean  @default(false)

  availableTemplates String[] @default(["classic"])

  isActive Boolean @default(true)

  subscriptions Subscription[]

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

// ─── Subscriptions ────────────────────────────────────

model Subscription {
  id     String @id @default(cuid())
  userId String
  user   User   @relation(fields: [userId], references: [id])
  planId String
  plan   Plan   @relation(fields: [planId], references: [id])

  status SubscriptionStatus @default(TRIALING)

  currentPeriodStart DateTime
  currentPeriodEnd   DateTime

  paystackSubscriptionCode String?
  paystackCustomerCode     String?
  paymentRef               String?

  restaurantId String?     @unique
  restaurant   Restaurant? @relation(fields: [restaurantId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([userId])
  @@index([restaurantId])
}

// ─── Restaurant (Tenant) ──────────────────────────────

model Restaurant {
  id          String  @id @default(cuid())
  slug        String  @unique
  name        String
  description String?
  logoUrl     String?
  coverUrl    String?
  phone       String?
  address     String?
  currency    String  @default("NGN")
  timezone    String  @default("Africa/Lagos")

  whatsappNumber String?

  dineInEnabled           Boolean       @default(true)
  pickupEnabled           Boolean       @default(true)
  deliveryEnabled         Boolean       @default(true)
  tableReservationEnabled Boolean       @default(false)
  tablesEnabled           Boolean       @default(false)

  dineInPaymentPolicy PaymentPolicy @default(PAY_BEFORE_SERVICE)

  isActive Boolean @default(true)

  primaryColor   String?
  fontFamily     String?
  activeTemplate String  @default("classic")

  ownerId String
  owner   User   @relation(fields: [ownerId], references: [id])

  subscription       Subscription?
  categories         MenuCategory[]
  orders             Order[]
  tables             TableSeat[]
  reservations       Reservation[]
  reservationSetting ReservationSetting?
  analytics          ScanEvent[]
  staff              StaffMember[]
  ratings            Rating[]
  notifications      Notification[]      // All notifications for this restaurant

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([slug])
  @@index([ownerId])
}

// ─── Menu ─────────────────────────────────────────────

model MenuCategory {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)
  name         String
  emoji        String?
  sortOrder    Int        @default(0)
  isActive     Boolean    @default(true)
  items        MenuItem[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  @@index([restaurantId])
}

model MenuItem {
  id             String       @id @default(cuid())
  categoryId     String
  category       MenuCategory @relation(fields: [categoryId], references: [id], onDelete: Cascade)
  name           String
  description    String?
  price          Decimal      @db.Decimal(10, 2)
  imageUrl       String?
  isAvailable    Boolean      @default(true)
  isTodaySpecial Boolean      @default(false)
  sortOrder      Int          @default(0)
  orderItems     OrderItem[]
  createdAt      DateTime     @default(now())
  updatedAt      DateTime     @updatedAt

  @@index([categoryId])
}

// ─── Orders ───────────────────────────────────────────

model Order {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])

  customerName  String
  customerPhone String
  customerEmail String?

  type          OrderType
  status        OrderStatus   @default(CONFIRMED)
  paymentStatus PaymentStatus @default(PENDING)

  paymentRef      String?
  paymentProvider String?

  tableNumber         String?
  tableId             String?
  tableLabel          String?
  dineInPaymentPolicy PaymentPolicy?
  dineInPaymentMethod DineInPaymentMethod?

  dineInAmountPaid        Decimal?  @db.Decimal(10, 2)
  dineInPaymentRecordedAt DateTime?
  dineInPaidMethod        DineInPaymentMethod?

  attendingStaffId String?
  attendingStaff   StaffMember? @relation("AttendingStaff", fields: [attendingStaffId], references: [id])

  deliveryAddress String?
  deliveryNotes   String?
  deliveryFee     Decimal @db.Decimal(10, 2) @default(0)

  subtotal Decimal @db.Decimal(10, 2)
  total    Decimal @db.Decimal(10, 2)

  items OrderItem[]

  whatsappNotified   Boolean   @default(false)
  whatsappNotifiedAt DateTime?

  rating Rating?

  linkedReservation Reservation? @relation(fields: [id], references: [preOrderId])

  cancelledById    String?
  cancelledAt      DateTime?
  cancellationNote String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([restaurantId])
  @@index([customerPhone])
  @@index([paymentRef])
  @@index([attendingStaffId])
}

model OrderItem {
  id         String   @id @default(cuid())
  orderId    String
  order      Order    @relation(fields: [orderId], references: [id], onDelete: Cascade)
  menuItemId String
  menuItem   MenuItem @relation(fields: [menuItemId], references: [id])

  name      String
  unitPrice Decimal @db.Decimal(10, 2)
  qty       Int
  notes     String?

  @@index([orderId])
}

// ─── Tables & Reservations ────────────────────────────

model ReservationSetting {
  id           String     @id @default(cuid())
  restaurantId String     @unique
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id], onDelete: Cascade)

  bookingMode          TableBookingMode   @default(FREE_BOOKING)
  paymentTiming        TablePaymentTiming @default(PAY_ON_ARRIVAL)
  inclusionType        TableInclusionType @default(TABLE_FEE_ONLY)
  defaultTableFee      Decimal?           @db.Decimal(10, 2)

  advanceBookingHours  Int     @default(0)
  holdDurationMinutes  Int     @default(60)
  minPartySize         Int     @default(1)
  maxPartySize         Int     @default(0)
  cancellationPolicy   String?
  bookingDescription   String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model TableSeat {
  id           String        @id @default(cuid())
  restaurantId String
  restaurant   Restaurant    @relation(fields: [restaurantId], references: [id], onDelete: Cascade)

  label        String
  description  String?
  capacity     Int           @default(2)
  isActive     Boolean       @default(true)
  sortOrder    Int           @default(0)

  bookingModeOverride    TableBookingMode?
  paymentTimingOverride  TablePaymentTiming?
  inclusionTypeOverride  TableInclusionType?
  tableFee               Decimal? @db.Decimal(10, 2)
  minimumSpend           Decimal? @db.Decimal(10, 2)

  reservations Reservation[]
  orders       Order[]

  @@index([restaurantId])
}

model Reservation {
  id           String            @id @default(cuid())
  restaurantId String
  restaurant   Restaurant        @relation(fields: [restaurantId], references: [id])
  tableId      String
  table        TableSeat         @relation(fields: [tableId], references: [id])

  customerName  String
  customerPhone String
  customerEmail String?
  partySize     Int              @default(1)

  startsAt  DateTime
  endsAt    DateTime?
  expiresAt DateTime
  status    ReservationStatus   @default(ACTIVE)

  qstashMessageId String?

  effectiveBookingMode    TableBookingMode
  effectivePaymentTiming  TablePaymentTiming
  effectiveInclusionType  TableInclusionType
  effectiveTableFee       Decimal? @db.Decimal(10, 2)

  reservationPaymentStatus PaymentStatus @default(PENDING)
  reservationPaymentRef    String?
  reservationAmountPaid    Decimal?      @db.Decimal(10, 2)

  preOrderId String? @unique

  specialRequests String?

  rating Rating?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([restaurantId])
  @@index([tableId])
  @@index([startsAt])
  @@index([customerPhone])
}

// ─── In-App Notifications ─────────────────────────────
//
// One Notification row is written per event per restaurant.
// Read status is tracked per-recipient via NotificationRead.
// Recipients are either the restaurant owner (admin) or staff members.
//
// Flow:
//   1. Event fires (new order, status change, etc.)
//   2. createNotification() writes a Notification row
//   3. dispatchNotification() publishes to Redis pub/sub channel
//      → SSE streams pick it up and push to connected clients
//   4. sendWebPush() sends to all stored VAPID subscriptions for
//      the restaurant's admin and/or staff (if PWA installed)
//   5. Client receives event, Zustand store increments unread count,
//      NotificationBell shows badge

model Notification {
  id           String               @id @default(cuid())
  restaurantId String
  restaurant   Restaurant           @relation(fields: [restaurantId], references: [id], onDelete: Cascade)

  type         NotificationType
  audience     NotificationAudience // Who should receive this

  title        String               // Short heading, e.g. "New Order #A3F2"
  body         String               // Detail line, e.g. "Dine-in · Table 5 · ₦4,500"

  // Optional deep-link — where clicking the notification navigates to
  // e.g. "/dashboard/burgerpalace/orders?orderId=xxx"
  actionUrl    String?

  // Contextual data (orderId, reservationId, etc.) stored as JSON
  // Used by the client to update local state without a refetch
  metadata     Json?

  reads        NotificationRead[]

  createdAt DateTime @default(now())

  @@index([restaurantId, createdAt])
  @@index([restaurantId, audience])
}

// Per-recipient read tracking.
// recipientType: "admin" = User (restaurant owner), "staff" = StaffMember
model NotificationRead {
  id             String       @id @default(cuid())
  notificationId String
  notification   Notification @relation(fields: [notificationId], references: [id], onDelete: Cascade)

  recipientType  String       // "admin" | "staff"
  recipientId    String       // userId (admin) or staffMemberId (staff)

  readAt         DateTime     @default(now())

  @@unique([notificationId, recipientType, recipientId])
  @@index([recipientType, recipientId])
}

// VAPID Web Push subscriptions — stored per recipient so we can
// send to all devices a user/staff member has installed the PWA on.
model PushSubscription {
  id             String       @id @default(cuid())

  // Belongs to either a User (admin) or StaffMember — not both
  userId         String?
  user           User?        @relation(fields: [userId], references: [id], onDelete: Cascade)
  staffMemberId  String?
  staffMember    StaffMember? @relation(fields: [staffMemberId], references: [id], onDelete: Cascade)

  restaurantId   String       // Denormalised for easy querying by tenant

  // The Web Push subscription object from the browser
  endpoint       String       @unique
  p256dh         String       // Public key
  auth           String       // Auth secret

  userAgent      String?
  createdAt      DateTime     @default(now())

  @@index([restaurantId])
  @@index([userId])
  @@index([staffMemberId])
}

// ─── Ratings ──────────────────────────────────────────

model Rating {
  id           String        @id @default(cuid())
  restaurantId String
  restaurant   Restaurant    @relation(fields: [restaurantId], references: [id])

  orderId       String?  @unique
  order         Order?   @relation(fields: [orderId], references: [id])
  reservationId String?  @unique
  reservation   Reservation? @relation(fields: [reservationId], references: [id])

  context       RatingContext

  foodQuality      Int?
  deliverySpeed    Int?
  packaging        Int?
  serviceQuality   Int?
  ambiance         Int?
  valueForMoney    Int?
  overallRating    Int

  comment          String?

  customerName  String?
  customerPhone String?

  createdAt DateTime @default(now())

  @@index([restaurantId])
}

// ─── Analytics ────────────────────────────────────────

model ScanEvent {
  id           String     @id @default(cuid())
  restaurantId String
  restaurant   Restaurant @relation(fields: [restaurantId], references: [id])
  scannedAt    DateTime   @default(now())
  userAgent    String?
  country      String?

  @@index([restaurantId, scannedAt])
}
```

---

## 7. Subscription Plans

### Default Plans (seeded)

#### Free
- Price: ₦0/mo — 2 Categories · 8 Items · Basic Analytics · WhatsApp · AwaMenu branding shown

#### Starter
- Price: configurable (e.g. ₦5,000/mo) — 10 Categories · 100 Items · Multiple Templates · Advanced Analytics · Remove Branding · Basic Support

#### Pro
- Price: configurable (e.g. ₦12,000/mo) — Unlimited Categories · Unlimited Items · Multiple Templates · Advanced Analytics · Remove Branding · Priority Support

### Plan Enforcement

```typescript
// lib/plan-limits.ts
export class PlanLimitError extends Error {
  constructor(message: string) { super(message); this.name = 'PlanLimitError' }
}

export async function checkCategoryLimit(restaurantId: string): Promise<void> {
  const restaurant = await db.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    include: { subscription: { include: { plan: true } }, _count: { select: { categories: true } } },
  })
  const max = restaurant.subscription?.plan.maxCategories ?? 2
  if (max !== -1 && restaurant._count.categories >= max)
    throw new PlanLimitError(`Your plan allows a maximum of ${max} categories. Upgrade to add more.`)
}

export async function checkMenuItemLimit(restaurantId: string): Promise<void> {
  const restaurant = await db.restaurant.findUniqueOrThrow({
    where: { id: restaurantId },
    include: { subscription: { include: { plan: true } }, categories: { include: { _count: { select: { items: true } } } } },
  })
  const max = restaurant.subscription?.plan.maxMenuItems ?? 8
  if (max !== -1) {
    const total = restaurant.categories.reduce((s, c) => s + c._count.items, 0)
    if (total >= max)
      throw new PlanLimitError(`Your plan allows a maximum of ${max} menu items. Upgrade to add more.`)
  }
}
```

---

## 8. Restaurant Onboarding Flow

```
Step 1 — /signup              → onboardingStatus: PENDING_PLAN
Step 2 — /onboarding/choose-plan
         FREE  → PENDING_SETUP (skip payment)
         PAID  → PENDING_PAYMENT
Step 3 — /onboarding/checkout (paid only) → Paystack → PENDING_SETUP on webhook
Step 4 — /onboarding/setup    → Restaurant created → COMPLETE → /dashboard/[slug]
```

---

## 9. Feature Specification

### 9.1 Landing Page & Pricing

**Route:** `/` — UI/UX referencing menurite.app. Hero, Features, Pricing (RSC from `Plan` table). CTAs link to `/signup?plan=free|starter|pro`.

**Route:** `/pricing` — full feature comparison table.

### 9.2 Public Customer Menu

**Route:** `/:slug` — Fully RSC. Sticky category nav, item cards, QR scan event, AwaMenu branding footer (hidden per plan). Customers never sign up.

### 9.3 Cart

Zustand store + `sessionStorage`. Bottom sheet drawer. Quantity controls, item notes, real-time subtotal.

### 9.4 Checkout Flow

#### Dine In
Step 2 — Table + payment method → Step 3 — Customer details → Step 4 — Review & confirm.
- `PAY_BEFORE_SERVICE`: Paystack → `CONFIRMED + PAID` on webhook.
- `PAY_AFTER_SERVICE`: immediate `CONFIRMED + PENDING`; customer can add items until `PREPARING`.

#### Pickup
Customer details → Review & Pay (Paystack).

#### Delivery
Address → Customer details → Review & Pay (Paystack).

#### Table Reservation
Full detail in §9.7. Steps driven by effective policy (see `lib/reservation-policy.ts`).

### 9.5 Pay-After-Service: Adding Items

"Add More Items" on order status page while status = `CONFIRMED`. Blocked at `PREPARING` / `READY` / `COMPLETED` / `CANCELLED`.

### 9.6 Order Status Page

**Route:** `/:slug/order/:orderId` — no login, 20s polling, rating CTA on completion, "Add More Items" for PAY_AFTER_SERVICE.

### 9.7 Table Reservation Management

#### Effective Policy Resolution

```typescript
// lib/reservation-policy.ts
export function resolveEffectivePolicy(setting: ReservationSetting, table: TableSeat) {
  return {
    bookingMode:   table.bookingModeOverride   ?? setting.bookingMode,
    paymentTiming: table.paymentTimingOverride ?? setting.paymentTiming,
    inclusionType: table.inclusionTypeOverride ?? setting.inclusionType,
    tableFee:      table.tableFee              ?? setting.defaultTableFee,
  }
}
```

#### Customer-facing Payment Matrix

| `bookingMode` | `paymentTiming` | `inclusionType` | Customer pays now |
|---|---|---|---|
| `FREE_BOOKING` | `PAY_ON_ARRIVAL` | — | Nothing |
| `FREE_BOOKING` | `PAY_AFTER_SERVICE` | — | Nothing |
| `ORDER_REQUIRED` | `PAY_ON_ARRIVAL` | — | Nothing |
| `ORDER_REQUIRED` | `PAY_ON_BOOKING` | `FOOD_ONLY` | Pre-order food total |
| `DEPOSIT_REQUIRED` | `PAY_ON_BOOKING` | `TABLE_FEE_ONLY` | Table deposit/fee |
| `DEPOSIT_REQUIRED` | `PAY_ON_BOOKING` | `FOOD_AND_TABLE_FEE` | Table fee + food total |
| `FULL_PAYMENT` | `PAY_ON_BOOKING` | `TABLE_FEE_ONLY` | Full table booking fee |
| `FULL_PAYMENT` | `PAY_ON_BOOKING` | `FOOD_AND_TABLE_FEE` | Full table fee + food |

#### Auto-Expiry

QStash scheduled at `startsAt + holdDurationMinutes`. On fire: `ACTIVE` → `EXPIRED`. On check-in: `CHECKED_IN`, QStash cancelled.

#### Availability Logic

A table is blocked for a slot if:
```
reservation.startsAt <= requestedSlot < reservation.startsAt + holdDurationMinutes
AND reservation.status = ACTIVE
```

### 9.8 Restaurant Admin Dashboard

| Tab | Description |
|---|---|
| Orders | Live feed; status updates; staff attribution; cancel |
| Menu | Category & item CRUD with plan limits |
| Tables | TableSeat CRUD with per-table overrides |
| Reservations | List; check-in; cancel; ReservationSetting config |
| Staff | Create/view staff; performance |
| Analytics | Scans, orders, revenue, ratings |
| Settings | Info, branding, QR, WhatsApp, payment policy, billing |

### 9.9 Super Admin Panel

**Route:** `/super-admin` — guard: `User.role === 'SUPER_ADMIN'`

Overview stats · Restaurants (search, activate, assign plan) · Restaurant detail · Plan CRUD · User management.

---

## 10. In-App Notification System

### Overview

Every significant event in the platform fires an in-app notification to the relevant admin and/or staff of the restaurant. Notifications are persisted in PostgreSQL (`Notification` table), delivered in real time over **SSE**, and pushed to installed PWA devices via **VAPID Web Push**.

### Notification Types & Audiences

| `NotificationType` | `NotificationAudience` | Trigger |
|---|---|---|
| `NEW_ORDER` | `BOTH` | Customer places any order |
| `ORDER_STATUS_CHANGED` | `BOTH` | Admin/staff updates order status |
| `ORDER_CANCELLED` | `BOTH` | Admin cancels an order |
| `NEW_RESERVATION` | `BOTH` | Customer books a table |
| `RESERVATION_CANCELLED` | `ADMIN` | Admin or expiry cancels a reservation |
| `RESERVATION_EXPIRED` | `ADMIN` | QStash auto-expires a reservation |
| `PAYMENT_RECEIVED` | `ADMIN` | Staff records a dine-in payment |

### Dispatch Flow

```
Event fires (server action / webhook handler)
  │
  ├─► createNotification()          — writes Notification row to Neon
  │
  ├─► redis.publish(`notify:${restaurantId}`, payload)
  │       │
  │       └─► SSE stream (/api/notifications/stream/[restaurantId])
  │               └─► connected admin browser / staff browser receives event
  │                   → Zustand store updates unread count + list
  │                   → NotificationBell badge increments
  │                   → Toast shown if tab is active
  │
  └─► sendWebPush(restaurantId, audience, payload)
          └─► queries PushSubscription rows for this restaurant + audience
              └─► web-push sends to each endpoint (VAPID)
                  → Device receives push even if browser is closed
                  → Service worker shows OS-level notification
                  → Click opens /dashboard/[slug]/orders (or actionUrl)
```

### Notification Dispatch Helper

```typescript
// lib/notifications.ts
import { db } from './db'
import { redis } from './redis'
import { sendWebPush } from './web-push'
import type { NotificationAudience, NotificationType } from '@prisma/client'

interface DispatchInput {
  restaurantId: string
  type: NotificationType
  audience: NotificationAudience
  title: string
  body: string
  actionUrl?: string
  metadata?: Record<string, unknown>
}

export async function dispatchNotification(input: DispatchInput): Promise<void> {
  // 1. Persist
  const notification = await db.notification.create({
    data: {
      restaurantId: input.restaurantId,
      type: input.type,
      audience: input.audience,
      title: input.title,
      body: input.body,
      actionUrl: input.actionUrl,
      metadata: input.metadata ?? {},
    },
  })

  const payload = {
    id: notification.id,
    type: notification.type,
    audience: notification.audience,
    title: notification.title,
    body: notification.body,
    actionUrl: notification.actionUrl,
    metadata: notification.metadata,
    createdAt: notification.createdAt.toISOString(),
  }

  // 2. SSE — publish to Redis channel; all connected SSE streams subscribe to this
  await redis.publish(`notify:${input.restaurantId}`, JSON.stringify(payload))

  // 3. Web Push — non-fatal; errors are caught and logged
  try {
    await sendWebPush(input.restaurantId, input.audience, payload)
  } catch (err) {
    console.error('[WebPush] Failed to send:', err)
  }
}
```

### SSE Stream Endpoint

```typescript
// app/api/notifications/stream/[restaurantId]/route.ts
import { redis } from '@/lib/redis'
import { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function GET(
  req: NextRequest,
  { params }: { params: { restaurantId: string } }
) {
  // Auth: verify caller is admin or staff of this restaurant (check session/staff-session header)
  // ... auth check omitted for brevity; must be implemented ...

  const encoder = new TextEncoder()
  const channel = `notify:${params.restaurantId}`

  const stream = new ReadableStream({
    async start(controller) {
      // Send a heartbeat every 25s to keep the connection alive
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(': heartbeat\n\n'))
      }, 25_000)

      const subscriber = redis.duplicate()
      await subscriber.subscribe(channel, (message) => {
        controller.enqueue(encoder.encode(`data: ${message}\n\n`))
      })

      req.signal.addEventListener('abort', async () => {
        clearInterval(heartbeat)
        await subscriber.unsubscribe(channel)
        subscriber.disconnect()
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
```

### Client SSE Hook

```typescript
// hooks/useNotificationStream.ts
'use client'
import { useEffect } from 'react'
import { useNotificationStore } from '@/stores/notification.store'

export function useNotificationStream(restaurantId: string) {
  const addNotification = useNotificationStore((s) => s.addNotification)

  useEffect(() => {
    const es = new EventSource(`/api/notifications/stream/${restaurantId}`)

    es.onmessage = (e) => {
      try {
        const notification = JSON.parse(e.data)
        addNotification(notification)
      } catch {
        // ignore malformed messages
      }
    }

    es.onerror = () => {
      // Browser auto-reconnects SSE after error; no manual retry needed
    }

    return () => es.close()
  }, [restaurantId, addNotification])
}
```

### Notification Zustand Store

```typescript
// stores/notification.store.ts
import { create } from 'zustand'

interface AppNotification {
  id: string
  type: string
  title: string
  body: string
  actionUrl?: string
  createdAt: string
  read: boolean
}

interface NotificationStore {
  notifications: AppNotification[]
  unreadCount: number
  addNotification: (n: Omit<AppNotification, 'read'>) => void
  markRead: (id: string) => void
  markAllRead: () => void
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notifications: [],
  unreadCount: 0,
  addNotification: (n) =>
    set((s) => ({
      notifications: [{ ...n, read: false }, ...s.notifications].slice(0, 100),
      unreadCount: s.unreadCount + 1,
    })),
  markRead: (id) =>
    set((s) => ({
      notifications: s.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      unreadCount: Math.max(0, s.unreadCount - 1),
    })),
  markAllRead: () =>
    set((s) => ({
      notifications: s.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),
}))
```

### VAPID Web Push

```typescript
// lib/web-push.ts
import webpush from 'web-push'
import { db } from './db'
import { env } from '@/env'
import type { NotificationAudience } from '@prisma/client'

webpush.setVapidDetails(
  `mailto:${env.VAPID_EMAIL}`,
  env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
)

export async function sendWebPush(
  restaurantId: string,
  audience: NotificationAudience,
  payload: Record<string, unknown>
): Promise<void> {
  const subs = await db.pushSubscription.findMany({
    where: {
      restaurantId,
      ...(audience === 'ADMIN'  ? { userId: { not: null } } : {}),
      ...(audience === 'STAFF'  ? { staffMemberId: { not: null } } : {}),
      // BOTH: no extra filter — fetch all
    },
  })

  await Promise.allSettled(
    subs.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          url: payload.actionUrl ?? '/',
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-192.png',
        })
      )
    )
  )
}
```

### VAPID Subscription Endpoints

```typescript
// app/api/notifications/push/subscribe/route.ts
// Saves a new PushSubscription row for the authenticated user or staff member.
// Body: { endpoint, keys: { p256dh, auth }, recipientType: 'admin' | 'staff', restaurantId }

// app/api/notifications/push/unsubscribe/route.ts
// Deletes PushSubscription row by endpoint.
```

### Push Subscription Hook

```typescript
// hooks/usePushSubscription.ts
'use client'
import { useEffect } from 'react'

export function usePushSubscription(restaurantId: string, recipientType: 'admin' | 'staff') {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    navigator.serviceWorker.ready.then(async (reg) => {
      const existing = await reg.pushManager.getSubscription()
      if (existing) return  // Already subscribed

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      })

      await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...sub.toJSON(),
          recipientType,
          restaurantId,
        }),
      })
    })
  }, [restaurantId, recipientType])
}
```

### UI Components

**`NotificationBell.tsx`** — renders in the admin top nav and staff top nav. Shows a red badge with unread count (max "99+"). Clicking opens `NotificationDrawer`.

**`NotificationDrawer.tsx`** — slide-in panel (bottom sheet on mobile, right drawer on desktop). Lists `notifications` from Zustand store. Each item is a `NotificationItem`. "Mark all read" button calls `markAllRead()` + `notification.actions.ts → markAllReadAction`. Clicking an item calls `markRead(id)` + server action, then navigates to `actionUrl`.

**`NotificationItem.tsx`** — icon (per `NotificationType`), title, body, relative time. Unread items have a highlighted background.

**`PushPermissionPrompt.tsx`** — banner shown once to admin/staff after login if `Notification.permission !== 'granted'`. "Enable Notifications" button calls `usePushSubscription`. Dismissable (stored in `localStorage`).

### Notification Server Actions

```typescript
// actions/notification.actions.ts

// Fetch paginated notifications for the current admin or staff
export const getNotificationsAction = action
  .schema(z.object({ restaurantId: z.string().cuid(), cursor: z.string().optional() }))
  .action(async ({ parsedInput, ctx }) => {
    // Returns Notification rows + NotificationRead status for the caller
    // Used on initial page load to hydrate the Zustand store
  })

// Mark a single notification read
export const markNotificationReadAction = action
  .schema(z.object({ notificationId: z.string().cuid(), recipientType: z.enum(['admin', 'staff']), recipientId: z.string() }))
  .action(async ({ parsedInput }) => {
    await db.notificationRead.upsert({
      where: {
        notificationId_recipientType_recipientId: {
          notificationId: parsedInput.notificationId,
          recipientType: parsedInput.recipientType,
          recipientId: parsedInput.recipientId,
        },
      },
      update: {},
      create: { ...parsedInput },
    })
  })

// Mark all notifications read for this recipient
export const markAllNotificationsReadAction = action
  .schema(z.object({ restaurantId: z.string().cuid(), recipientType: z.enum(['admin', 'staff']), recipientId: z.string() }))
  .action(async ({ parsedInput }) => {
    const unread = await db.notification.findMany({
      where: {
        restaurantId: parsedInput.restaurantId,
        reads: { none: { recipientType: parsedInput.recipientType, recipientId: parsedInput.recipientId } },
      },
      select: { id: true },
    })
    await db.notificationRead.createMany({
      data: unread.map((n) => ({
        notificationId: n.id,
        recipientType: parsedInput.recipientType,
        recipientId: parsedInput.recipientId,
      })),
      skipDuplicates: true,
    })
  })
```

### Where `dispatchNotification` Is Called

| Location | Type | Audience |
|---|---|---|
| Paystack webhook — ORDER branch | `NEW_ORDER` | `BOTH` |
| `updateOrderStatusAction` | `ORDER_STATUS_CHANGED` | `BOTH` |
| `cancelOrderAction` | `ORDER_CANCELLED` | `BOTH` |
| Paystack webhook — RESERVATION_PAYMENT branch | `NEW_RESERVATION` | `BOTH` |
| `createReservationAction` (PAY_ON_ARRIVAL / PAY_AFTER_SERVICE) | `NEW_RESERVATION` | `BOTH` |
| `cancelReservationAction` | `RESERVATION_CANCELLED` | `ADMIN` |
| QStash webhook — EXPIRE_RESERVATION | `RESERVATION_EXPIRED` | `ADMIN` |
| `recordDineInPaymentAction` | `PAYMENT_RECEIVED` | `ADMIN` |

---

## 11. PWA Configuration

### Goal

Admin and staff can **install AwaMenu as a PWA** on their phone or desktop. Once installed:
- The app opens full-screen (no browser chrome)
- Works offline for viewing the last-loaded order list (cache-first for UI shell)
- Receives native OS push notifications even when the browser is closed
- Auto-prompts "Add to Home Screen" on first visit to `/dashboard/[slug]` or `/staff/[slug]`

### Library

We use **serwist** (the maintained fork of `next-pwa`) for service worker generation.

```bash
bun add serwist @serwist/next
```

### next.config.ts

```typescript
// next.config.ts
import withSerwist from '@serwist/next'

const withPWA = withSerwist({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  // Only activate SW in production; dev uses normal Next.js HMR
  disable: process.env.NODE_ENV === 'development',
})

export default withPWA({
  // ... rest of Next.js config
})
```

### Service Worker (`app/sw.ts`)

```typescript
// app/sw.ts
import { defaultCache } from '@serwist/next/worker'
import { Serwist } from 'serwist'

const sw = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    // Cache the dashboard UI shell (stale-while-revalidate)
    {
      matcher: /^\/(dashboard|staff)\//,
      handler: 'StaleWhileRevalidate',
      options: { cacheName: 'dashboard-shell', expiration: { maxAgeSeconds: 60 * 60 * 24 } },
    },
    // Cache R2 images aggressively (they are content-addressed)
    {
      matcher: new RegExp(`^${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}`),
      handler: 'CacheFirst',
      options: { cacheName: 'r2-images', expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 } },
    },
    ...defaultCache,
  ],
})

// Handle Web Push — show OS notification when tab is not focused
sw.addEventListeners()

self.addEventListener('push', (event: PushEvent) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'AwaMenu', {
      body: data.body,
      icon: data.icon ?? '/icons/icon-192.png',
      badge: data.badge ?? '/icons/icon-192.png',
      data: { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close()
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const target = event.notification.data?.url ?? '/'
      for (const client of clientList) {
        if (client.url.includes(target) && 'focus' in client) return client.focus()
      }
      return clients.openWindow(target)
    })
  )
})
```

### Web App Manifest (`public/manifest.webmanifest`)

```json
{
  "name": "AwaMenu",
  "short_name": "AwaMenu",
  "description": "Restaurant management — orders, menu, staff",
  "start_url": "/dashboard",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#ffffff",
  "theme_color": "#18181b",
  "icons": [
    { "src": "/icons/icon-192.png",          "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-384.png",          "sizes": "384x384", "type": "image/png" },
    { "src": "/icons/icon-512.png",          "sizes": "512x512", "type": "image/png" },
    { "src": "/icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ],
  "shortcuts": [
    {
      "name": "Orders",
      "url": "/dashboard",
      "description": "View live orders"
    }
  ],
  "categories": ["food", "business", "productivity"]
}
```

### PWA Metadata in `app/layout.tsx`

```typescript
export const metadata = {
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'AwaMenu',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
}
```

### Install Prompt Component

```typescript
// components/notifications/InstallPWAPrompt.tsx
'use client'
import { useEffect, useState } from 'react'

// Captures the beforeinstallprompt event and shows a custom banner.
// Only shown to admin and staff on their respective routes.
// Dismissed state stored in localStorage.

export function InstallPWAPrompt() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 rounded-xl bg-zinc-900 p-4 text-white shadow-2xl">
      <p className="font-semibold">Install AwaMenu</p>
      <p className="text-sm text-zinc-400">Add to your home screen for quick access and push notifications</p>
      <div className="mt-3 flex gap-2">
        <button
          className="flex-1 rounded-lg bg-white py-2 text-sm font-medium text-zinc-900"
          onClick={async () => { await prompt.prompt(); setPrompt(null) }}
        >
          Install
        </button>
        <button
          className="rounded-lg px-4 py-2 text-sm text-zinc-400"
          onClick={() => { localStorage.setItem('pwa-prompt-dismissed', '1'); setPrompt(null) }}
        >
          Not now
        </button>
      </div>
    </div>
  )
}
```

### Where PWA Prompt & Push Are Mounted

- `app/(dashboard)/layout.tsx` — renders `<InstallPWAPrompt />` and `<PushPermissionPrompt />`, calls `useNotificationStream(restaurantId)` and `usePushSubscription(restaurantId, 'admin')`
- `app/(staff)/layout.tsx` — same, with `recipientType: 'staff'`

### Offline Behaviour

- The UI shell (nav, layout, last-rendered order list) is served from the service worker cache when offline
- Any server action attempted while offline fails gracefully with a toast: "You're offline. Changes will not be saved."
- `navigator.onLine` + `window` `online`/`offline` events drive the offline banner in `ui.store.ts`

---

## 12. Staff Management & Order Attribution

### Staff Account System

Staff are `StaffMember` records scoped to a restaurant. Login at `/staff/[slug]` using generated `staffId` + 4-digit PIN. Redis session: `staff:{staffMemberId}:session`, 8h TTL.

### Staff ID Generation

```typescript
// lib/staff-id.ts
import { nanoid } from 'nanoid'

export function generateStaffId(restaurantSlug: string, sequence: number): string {
  const slug = restaurantSlug.toUpperCase().slice(0, 12)
  const seq = String(sequence).padStart(3, '0')
  const suffix = nanoid(2).toUpperCase()
  return `AWA-${slug}-${seq}-#${suffix}`
}
```

### Staff Capabilities

**Can:** View new + ongoing orders; update dine-in status; record dine-in payment; receive in-app + push notifications.

**Cannot:** Access analytics, settings, cancel orders, view other staff profiles.

### Order Attribution (PIN-at-payment)

```typescript
// actions/order.actions.ts
export const recordDineInPaymentAction = action
  .schema(recordDineInPaymentSchema)
  .action(async ({ parsedInput }) => {
    const { orderId, staffId, pin, amountPaid, paymentMethod } = parsedInput

    const staff = await db.staffMember.findUniqueOrThrow({ where: { staffId, isActive: true } })
    const valid = await bcrypt.compare(pin, staff.pinHash)
    if (!valid) throw new Error('Invalid staff PIN')

    const order = await db.order.findUniqueOrThrow({ where: { id: orderId }, include: { restaurant: true } })
    if (order.restaurant.id !== staff.restaurantId) throw new Error('Staff does not belong to this restaurant')

    await db.order.update({
      where: { id: orderId },
      data: {
        attendingStaffId: staff.id,
        dineInAmountPaid: amountPaid,
        dineInPaidMethod: paymentMethod,
        dineInPaymentRecordedAt: new Date(),
        paymentStatus: 'PAID',
        status: 'COMPLETED',
      },
    })

    // Notify admin that payment was recorded
    await dispatchNotification({
      restaurantId: order.restaurantId,
      type: 'PAYMENT_RECEIVED',
      audience: 'ADMIN',
      title: `Payment recorded — #${order.id.slice(-6).toUpperCase()}`,
      body: `${staff.name} recorded ${paymentMethod === 'CASH' ? 'cash' : 'transfer/card'} payment of ${order.total}`,
      actionUrl: `/dashboard/${order.restaurant.slug}/orders?orderId=${order.id}`,
      metadata: { orderId: order.id, staffId: staff.id },
    })

    return { success: true }
  })
```

---

## 13. Rating System

### When Rating CTA Appears

| Order Type | Trigger |
|---|---|
| Dine In (PAY_BEFORE_SERVICE) | `order.status = DELIVERED` or `COMPLETED` |
| Dine In (PAY_AFTER_SERVICE) | `order.status = COMPLETED` |
| Pickup | `order.status = READY` |
| Delivery | `order.status = DELIVERED` |
| Table Reservation | 30 min after `reservation.status = CHECKED_IN` |

### Rating Metrics by Context

| Metric | Dine In | Delivery | Pickup | Reservation |
|---|---|---|---|---|
| Food Quality | ✅ | ✅ | ✅ | ✅ |
| Delivery Speed | ❌ | ✅ | ❌ | ❌ |
| Packaging | ❌ | ✅ | ✅ | ❌ |
| Service Quality | ✅ | ❌ | ❌ | ✅ |
| Ambiance | ✅ | ❌ | ❌ | ✅ |
| Value for Money | ✅ | ✅ | ✅ | ✅ |
| Overall Rating | ✅ | ✅ | ✅ | ✅ |

---

## 14. API Design

### Webhook: Paystack

`POST /api/webhooks/paystack` — verify HMAC-SHA512 → handle `charge.success` → branch on `metadata.type`:

- **`ORDER`**: confirm order + email + WhatsApp + `dispatchNotification(NEW_ORDER, BOTH)` → `200`
- **`SUBSCRIPTION`**: upsert Subscription → `PENDING_SETUP` → email → `200`
- **`RESERVATION_PAYMENT`**: confirm reservation payment + email + WhatsApp + `dispatchNotification(NEW_RESERVATION, BOTH)` + schedule QStash expiry → `200`

### Webhook: QStash

`POST /api/webhooks/qstash` — verify signature → `EXPIRE_RESERVATION` → set `EXPIRED` + `dispatchNotification(RESERVATION_EXPIRED, ADMIN)` → `200`

### SSE Stream

`GET /api/notifications/stream/[restaurantId]` — auth-gated (admin or staff of restaurant). Subscribes to Redis pub/sub channel `notify:{restaurantId}`. Keeps connection alive with 25s heartbeat comments.

### VAPID Push

`POST /api/notifications/push/subscribe` — saves `PushSubscription` row.
`POST /api/notifications/push/unsubscribe` — deletes `PushSubscription` row by endpoint.

### QR Scan Tracker

`GET /api/qr/[slug]` — log `ScanEvent` → `301` redirect.

---

## 15. Security Model

**Layer 1 — Cloudflare Edge:** WAF, Turnstile, DDoS, bot scoring.

**Layer 2 — Rate Limiting:**
```typescript
export const menuRateLimit  = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(60, '1m') })
export const orderRateLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(5, '1h') })
export const adminRateLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(30, '1m') })
export const staffRateLimit = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '5m') })
export const sseRateLimit   = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '1m') })
```

**SSE auth:** The `/api/notifications/stream/[restaurantId]` endpoint validates the caller's session (admin) or staff-session (staff) before opening the stream. Unauthenticated requests receive `401`.

**VAPID keys:** `VAPID_PRIVATE_KEY` is server-only; `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is public. Generated once via `web-push generate-vapid-keys` and stored in env.

**Layer 3 — Server Actions:** `next-safe-action` + Zod. Plan limits, staff PIN, notification read ownership all enforced here.

**Layer 4 — Auth Guards:** better-auth (owner), Redis session (staff), role check (super admin).

**Layer 5 — Database RLS:** Tenant isolation on all tables.

---

## 16. Payment Integration

```typescript
// lib/payments.ts

export async function initiateOrderPayment(params: PaystackOrderParams) {
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.customerEmail || `${params.orderId}@orders.awamenu.com`,
      amount: params.amountKobo,
      callback_url: `${env.NEXT_PUBLIC_APP_URL}/${params.restaurantSlug}/order/${params.orderId}`,
      metadata: { type: 'ORDER', orderId: params.orderId, customerName: params.customerName },
    }),
  })
  return (await res.json()).data.authorization_url
}

export async function initiateReservationPayment(params: PaystackReservationParams) {
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.customerEmail || `${params.reservationId}@reservations.awamenu.com`,
      amount: params.amountKobo,
      callback_url: `${env.NEXT_PUBLIC_APP_URL}/${params.restaurantSlug}/reservation/${params.reservationId}`,
      metadata: { type: 'RESERVATION_PAYMENT', reservationId: params.reservationId, customerName: params.customerName },
    }),
  })
  return (await res.json()).data.authorization_url
}

export async function initiateSubscriptionPayment(params: PaystackSubscriptionParams) {
  const plan = await db.plan.findUniqueOrThrow({ where: { id: params.planId } })
  const res = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: params.customerEmail,
      amount: Number(plan.monthlyPrice) * 100,
      callback_url: `${env.NEXT_PUBLIC_APP_URL}/onboarding/setup`,
      metadata: { type: 'SUBSCRIPTION', userId: params.userId, planId: params.planId },
    }),
  })
  return (await res.json()).data.authorization_url
}

export function verifyPaystackWebhook(body: string, sig: string): boolean {
  const hash = crypto.createHmac('sha512', env.PAYSTACK_WEBHOOK_SECRET).update(body).digest('hex')
  return hash === sig
}
```

---

## 17. WhatsApp Integration

All plans include WhatsApp notifications. Restaurant adds their number during onboarding (updatable in Settings). WhatsApp failures are non-fatal — caught, logged to Sentry, webhook still returns `200`.

```typescript
// lib/whatsapp.ts
export async function sendOrderNotification(toNumber: string, order: OrderNotificationPayload) {
  const itemLines = order.items
    .map(i => `  • ${i.name} x${i.qty} — ${order.currency} ${(i.unitPrice * i.qty).toLocaleString()}`)
    .join('\n')

  const locationLine =
    order.type === 'DINE_IN'  ? `Table: ${order.tableLabel ?? order.tableNumber ?? 'N/A'}` :
    order.type === 'DELIVERY' ? `Delivery to: ${order.deliveryAddress}` : 'Pickup'

  const paymentLine =
    order.type === 'DINE_IN'
      ? `Payment: ${order.dineInPaymentMethod === 'CASH' ? 'Cash (to collect)' : 'Transfer/Card (to collect)'}`
      : `Payment: Paid online`

  await client.messages.create({
    from: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
    to: `whatsapp:${toNumber}`,
    body: [
      `🛎 *New Order — #${order.id.slice(-6).toUpperCase()}*`, ``,
      `*Customer:* ${order.customerName}`, `*Phone:* ${order.customerPhone}`,
      `*Type:* ${order.type.replace('_', ' ')}`, locationLine, paymentLine, ``,
      `*Items:*`, itemLines, ``,
      `*Total: ${order.currency} ${order.total.toLocaleString()}*`,
    ].join('\n'),
  })
}
```

---

## 18. Mobile-First UI/UX Strategy

**UI/UX reference for landing page:** menurite.app

- Bottom sheet cart (Framer Motion slide-up)
- Bottom nav (admin/staff) — fixed bar < 768px, left sidebar on desktop; includes `NotificationBell`
- Sticky category nav with `IntersectionObserver`
- Tap targets min 44×44px
- Skeleton screens, optimistic UI
- Min 16px body font; inputs `font-size: 16px` (prevents iOS zoom)
- `next/image` WebP via Cloudflare CDN, lazy-loaded
- Offline banner when `navigator.onLine = false`

---

## 19. Error Tracking & Observability

```typescript
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  integrations: [Sentry.prismaIntegration()],
  beforeSend(event) {
    if (event.user) { delete event.user.email; delete event.user.ip_address }
    return event
  },
})
```

Monitored: Unhandled exceptions, failed server actions, slow Prisma queries, payment webhook failures, WhatsApp failures, QStash failures, R2 upload failures, staff PIN failures, **SSE errors**, **Web Push delivery failures**.

---

## 20. Project Setup & Commands

### Prerequisites

Bun >= 1.1, Node.js >= 20, Git. Accounts: Neon, Upstash, Cloudflare, Vercel, Paystack, Resend, Twilio, Sentry, Posthog.

### Initial Setup

```bash
bunx create-next-app@latest awamenu \
  --typescript --tailwind --app --no-src-dir --import-alias "@/*"

cd awamenu

bun add prisma @prisma/client \
  better-auth \
  @upstash/redis @upstash/ratelimit @upstash/qstash \
  next-safe-action zod zustand \
  @tanstack/react-query \
  paystack stripe \
  resend @react-email/components \
  twilio \
  web-push \
  serwist @serwist/next \
  qrcode.react sharp \
  @aws-sdk/client-s3 @aws-sdk/s3-request-presigner \
  nanoid bcryptjs \
  @t3-oss/env-nextjs \
  @sentry/nextjs \
  posthog-js posthog-node \
  framer-motion recharts \
  @radix-ui/react-slot class-variance-authority clsx tailwind-merge lucide-react

bun add -d @biomejs/biome husky lint-staged @types/bcryptjs @types/web-push @types/node

bunx shadcn@latest init
bunx shadcn@latest add button input label card badge dialog sheet \
  dropdown-menu select tabs toast sonner form skeleton separator avatar

bunx prisma init
bunx biome init
bun x husky init
echo "bun lint-staged && bun tsc --noEmit" > .husky/pre-commit
cp .env.example .env.local

# Generate VAPID keys (run once; save output to .env.local)
bunx web-push generate-vapid-keys
```

### Database Commands

```bash
bun prisma db push          # Push schema (dev)
bun prisma generate         # Regenerate client
bun prisma db seed          # Seed plans + super admin
bun prisma migrate dev --name <description>
bun prisma migrate deploy   # Production
bun prisma studio
```

### Dev Commands

```bash
bun dev                     # Turbopack dev server
bun tsc --noEmit            # Type check
bun biome check .           # Lint
bun biome check --apply .   # Lint + autofix
```

### package.json Scripts

```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "start": "next start",
    "lint": "biome check .",
    "format": "biome format --write .",
    "typecheck": "tsc --noEmit",
    "db:push": "prisma db push",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "prisma db seed",
    "db:studio": "prisma studio",
    "db:reset": "prisma migrate reset",
    "vapid:generate": "web-push generate-vapid-keys"
  },
  "prisma": { "seed": "bun prisma/seed.ts" },
  "lint-staged": {
    "*.{ts,tsx}": ["biome check --apply", "biome format --write"],
    "prisma/schema.prisma": ["bunx prisma format"]
  }
}
```

---

## 21. Development Workflow

### Biome Config

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "correctness": { "noUnusedVariables": "error" },
      "security": { "noDangerouslySetInnerHtmlWithChildren": "error" }
    }
  },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 }
}
```

### CI Pipeline

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install --frozen-lockfile
      - run: bun tsc --noEmit
      - run: bun biome ci .
      - run: bun prisma validate
      - run: bun run build
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL_CI }}
          SKIP_ENV_VALIDATION: true
      - run: bun sentry-cli sourcemaps inject .next && bun sentry-cli sourcemaps upload .next
        env:
          SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
          SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
          SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
```

---

## 22. Environment Variables

```bash
# ─── App ──────────────────────────────────────────────
NEXT_PUBLIC_APP_URL=https://awamenu.com

# ─── Database (Neon) ──────────────────────────────────
DATABASE_URL=postgresql://...?sslmode=require
DIRECT_DATABASE_URL=postgresql://...?sslmode=require

# ─── Redis (Upstash) ──────────────────────────────────
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# ─── Auth (better-auth) ───────────────────────────────
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://awamenu.com

# ─── Payments (Paystack) ──────────────────────────────
PAYSTACK_SECRET_KEY=sk_live_...
PAYSTACK_WEBHOOK_SECRET=...

# ─── Payments (Stripe — optional) ────────────────────
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# ─── Email (Resend) ───────────────────────────────────
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=orders@awamenu.com

# ─── WhatsApp (Twilio) ────────────────────────────────
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=...
TWILIO_WHATSAPP_FROM=+14155238886

# ─── Storage (Cloudflare R2) ──────────────────────────
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=awamenu-assets
NEXT_PUBLIC_R2_PUBLIC_URL=https://assets.awamenu.com

# ─── QStash (Upstash) ─────────────────────────────────
QSTASH_TOKEN=...
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...

# ─── Web Push (VAPID) ─────────────────────────────────
# Generate with: bunx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY=...   # Public — safe to expose to browser
VAPID_PRIVATE_KEY=...              # Private — server only, never expose
VAPID_EMAIL=admin@awamenu.com      # Contact email for VAPID

# ─── Sentry ───────────────────────────────────────────
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=...
SENTRY_ORG=...
SENTRY_PROJECT=...

# ─── Analytics (Posthog) ─────────────────────────────
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com

# ─── Cloudflare (Turnstile) ───────────────────────────
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...

# ─── Super Admin ──────────────────────────────────────
SUPER_ADMIN_EMAIL=admin@awamenu.com

# ─── Feature Flags ────────────────────────────────────
SKIP_ENV_VALIDATION=   # "true" in CI only
```

---

## 23. Deployment Strategy

### Vercel

- Connect GitHub → auto-deploy on push to `main`; every PR gets a preview URL
- Set all env vars including VAPID keys in Vercel Dashboard

### Neon

- `main` → production, `dev` → local. Migrations via `bun prisma migrate deploy`.

### R2 Bucket

```
awamenu-assets/restaurants/{restaurantId}/logo.webp
                                          cover.webp
                                          menu/{menuItemId}.webp
```

Custom domain: `assets.awamenu.com` → R2 via Cloudflare DNS.

### PWA Icons

Generate the four required icons before launch:
- `public/icons/icon-192.png` (192×192)
- `public/icons/icon-384.png` (384×384)
- `public/icons/icon-512.png` (512×512)
- `public/icons/icon-maskable-512.png` (512×512, with safe-zone padding for maskable)

### Prisma Seed

Creates: default FREE / STARTER / PRO plans + super admin user (`SUPER_ADMIN_EMAIL`, `role = SUPER_ADMIN`, `onboardingStatus = COMPLETE`, `emailVerified = true`).

---

## 24. Zero-Cost Infrastructure Breakdown

| Service | Free Tier | Usage |
|---|---|---|
| Vercel | 100GB bandwidth, unlimited deploys | App hosting + SSE streams |
| Neon | 0.5GB storage, 190 compute hours/mo | PostgreSQL |
| Upstash Redis | 10,000 commands/day | Sessions, cart, rate limits, SSE pub/sub |
| Upstash QStash | 500 messages/day | Reservation expiry |
| Cloudflare (CDN + WAF + Turnstile) | Unlimited | Edge, security |
| Cloudflare R2 | 10GB storage, 10M reads/mo | Images, QR codes |
| Resend | 3,000 emails/month | Confirmations |
| Sentry | 5,000 errors/month | Error tracking |
| Posthog | 1M events/month | Analytics |
| GitHub Actions | 2,000 min/month | CI/CD |
| Twilio WhatsApp | Trial credit (~$15) | Order notifications |
| web-push (VAPID) | Free — uses browser infra | Push notifications |
| serwist / Service Worker | Free | PWA, offline, push handler |
| **Total** | **₦0 / $0** | MVP viable |

> **SSE note:** Vercel Hobby limits streaming responses to 60s on Edge runtime. Use `runtime = 'nodejs'` for the SSE route to get longer-lived connections. Monitor function duration — if needed, move SSE to a small Fly.io free instance post-MVP.

---

## 25. Phase Plan — Full Build

### Phase 0 — Foundation (Days 1–3)

- [ ] Full setup from §20
- [ ] `t3-env` schema including VAPID keys
- [ ] `biome.json`, Husky pre-commit
- [ ] Full Prisma schema from §6
- [ ] `prisma/seed.ts` — plans + super admin
- [ ] `bun prisma db push` + `bun prisma db seed`
- [ ] `better-auth` Prisma adapter
- [ ] Upstash Redis client
- [ ] Sentry setup
- [ ] `app/proxy.ts`
- [ ] PWA: `next.config.ts` with serwist, `public/manifest.webmanifest`, icons, `app/sw.ts`
- [ ] CI passing; `bun dev` starts without errors

### Phase 1 — Auth & Onboarding (Days 4–8)

- [ ] `/signup`, `/login`, auth route handler
- [ ] Onboarding + dashboard layout guards
- [ ] `/onboarding/choose-plan` → `/onboarding/checkout` → `/onboarding/setup`
- [ ] Paystack webhook — SUBSCRIPTION branch
- [ ] R2 presigned upload
- [ ] `completeSetupAction`
- [ ] Welcome email

### Phase 2 — Landing Page & Pricing (Days 9–11)

- [ ] Landing page (UI ref: menurite.app) — Hero, Features, Pricing
- [ ] `/pricing` comparison table
- [ ] SEO metadata, responsive to 375px

### Phase 3 — Menu Builder (Days 12–16)

- [ ] Admin dashboard shell + nav (includes `NotificationBell` in nav)
- [ ] `CategoryManager.tsx`, `MenuEditor.tsx`, item form, photo upload
- [ ] Plan limit enforcement + `PlanLimitBanner.tsx`

### Phase 4 — Public Menu & Cart (Days 17–20)

- [ ] Public menu RSC, `CategoryNav`, `MenuItemCard`, `CartDrawer`
- [ ] QR generation + scan tracker

### Phase 5 — Checkout, Orders & WhatsApp (Days 21–27)

- [ ] Full checkout flow (all order types)
- [ ] `createOrderAction`
- [ ] Paystack webhook — ORDER branch + email + WhatsApp + `dispatchNotification`
- [ ] Order status page (20s polling)
- [ ] PAY_AFTER_SERVICE "Add More Items"
- [ ] Admin orders panel — live feed, status updates, cancel + `dispatchNotification`

### Phase 6 — In-App Notifications & PWA (Days 28–33)

- [ ] `Notification` + `NotificationRead` + `PushSubscription` DB models (already in schema)
- [ ] `lib/notifications.ts` — `dispatchNotification` helper
- [ ] `lib/web-push.ts` — VAPID send logic
- [ ] `app/api/notifications/stream/[restaurantId]/route.ts` — SSE endpoint (Node.js runtime)
- [ ] `app/api/notifications/push/subscribe/route.ts`
- [ ] `app/api/notifications/push/unsubscribe/route.ts`
- [ ] `stores/notification.store.ts` — Zustand store
- [ ] `hooks/useNotificationStream.ts` — SSE hook
- [ ] `hooks/usePushSubscription.ts` — VAPID subscribe hook
- [ ] `NotificationBell.tsx` — bell + unread badge
- [ ] `NotificationDrawer.tsx` — slide-in panel
- [ ] `NotificationItem.tsx`
- [ ] `PushPermissionPrompt.tsx`
- [ ] `InstallPWAPrompt.tsx`
- [ ] `notification.actions.ts` — get, markRead, markAllRead
- [ ] Wire `dispatchNotification` into all events from the dispatch table in §10
- [ ] Mount SSE hook + PWA prompts in dashboard and staff layouts
- [ ] `app/sw.ts` — push event handler + notificationclick handler
- [ ] Test: install PWA on Android Chrome; receive push notification when browser is closed
- [ ] Test: SSE delivers real-time notification to open admin tab

### Phase 7 — Staff Management & Dine-In Payments (Days 34–38)

- [ ] `StaffManager.tsx`, `staff.actions.ts` — create, deactivate, reset PIN
- [ ] `/staff/[slug]/login` + Redis session + staff layout guard
- [ ] `StaffOrderFeed.tsx`, `DineInPaymentModal.tsx`
- [ ] `recordDineInPaymentAction` with `dispatchNotification(PAYMENT_RECEIVED, ADMIN)`

### Phase 8 — Table Reservations (Days 39–44)

- [ ] `ReservationSettingForm.tsx` with progressive disclosure
- [ ] `TableManager.tsx` with per-table overrides
- [ ] Public `/[slug]/tables` + `TableGrid.tsx` (30s polling)
- [ ] `lib/reservation-policy.ts` — `resolveEffectivePolicy`
- [ ] `createReservationAction` + policy snapshots + QStash expiry + `dispatchNotification`
- [ ] Paystack webhook — RESERVATION_PAYMENT branch + `dispatchNotification`
- [ ] QStash webhook — EXPIRE_RESERVATION + `dispatchNotification`
- [ ] Admin reservations tab — list, check-in, cancel
- [ ] Reservation confirmation email + WhatsApp

### Phase 9 — Rating System (Days 45–48)

- [ ] `submitRatingAction`, `/[slug]/rate/[orderId]`, `RatingForm.tsx`
- [ ] Rating CTA on order status page, double-rating prevention
- [ ] Admin analytics — ratings summary + staff breakdown

### Phase 10 — Analytics & Super Admin (Days 49–53)

- [ ] Free: totals only. Starter/Pro: full Recharts dashboard
- [ ] `/super-admin` — overview, restaurants, plan CRUD, users
- [ ] `super-admin.actions.ts`

### Phase 11 — Hardening & Launch (Days 54–60)

- [ ] Full RLS SQL migration
- [ ] Rate limiting on all routes including SSE endpoint
- [ ] Turnstile on signup + checkout
- [ ] All `loading.tsx` and `error.tsx` files
- [ ] 404 handling for unknown slugs
- [ ] Offline banner UI (`navigator.onLine`)
- [ ] PWA audit: Lighthouse PWA score ≥ 90
- [ ] Push notification E2E test on iOS (Safari 16.4+) and Android Chrome
- [ ] Responsive QA: 375px / 390px / 768px / 1280px
- [ ] Accessibility audit
- [ ] Sentry source maps + error boundaries
- [ ] Posthog funnel events
- [ ] Production env vars in Vercel (including VAPID keys)
- [ ] `bun prisma migrate deploy` on production
- [ ] Smoke test all critical flows including notification delivery
- [ ] Custom domains configured (awamenu.com + assets.awamenu.com)

---

## 26. Future Roadmap

**High value, low complexity:**
- Menu import from photo (Anthropic Claude vision API)
- Annual billing with discount
- Notification preferences per admin/staff (mute certain types)

**High value, medium complexity:**
- Custom domains per restaurant (Cloudflare Workers)
- Kitchen Display System (KDS) — second screen, SSE-powered
- SMS order updates via Termii
- Service worker background sync for offline order queue

**Medium value:**
- Multi-language menu
- Loyalty stamp card
- Inventory tracking (auto-mark unavailable at 0)
- Delivery zone configuration + zone-based fees

**Long-term:**
- Delivery driver assignment + tracking
- Multiple branches per restaurant
- White-label mode

---

## 27. Coding Standards & Conventions

### TypeScript

- `strict: true` — non-negotiable. No `any`. Zod schemas are source of truth.

```typescript
import { z } from 'zod'
export const createMenuItemSchema = z.object({
  name: z.string().min(1).max(100),
  price: z.number().positive().multipleOf(0.01),
  categoryId: z.string().cuid(),
})
export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>
```

### Naming Conventions

| Thing | Convention | Example |
|---|---|---|
| Files | kebab-case | `notification-bell.tsx` |
| Components | PascalCase | `NotificationBell` |
| Functions | camelCase | `dispatchNotification` |
| Server Actions | `*.actions.ts` | `notification.actions.ts` |
| Zod Schemas | `*Schema` | `submitRatingSchema` |
| Types/Interfaces | PascalCase | `AppNotification` |
| Env vars | SCREAMING_SNAKE | `VAPID_PRIVATE_KEY` |
| DB models | PascalCase | `PushSubscription` |
| DB columns | camelCase | `recipientType` |

### Component Patterns

- Server Components by default — `'use client'` only when needed
- No barrel exports — import directly from file path
- `loading.tsx` and `error.tsx` co-located with every route

### Server Action Pattern

```typescript
export const createMenuItemAction = action
  .schema(createMenuItemSchema)
  .action(async ({ parsedInput, ctx }) => {
    await checkMenuItemLimit(ctx.restaurantId)
    const item = await db.menuItem.create({ data: parsedInput })
    return { item }
  })
```

### Commits (Conventional Commits)

```
feat: add in-app notification system (SSE + Zustand store)
feat: add VAPID Web Push for installed PWA devices
feat: add PWA manifest, service worker, install prompt
feat: add NotificationBell and NotificationDrawer components
feat: add dynamic table booking policy
feat: add staff PIN-at-payment attribution
chore: add serwist, web-push dependencies
chore: add Notification, NotificationRead, PushSubscription models
docs: update spec v4.2.0
```

---

*This document is the single source of truth for AwaMenu v4.2.0. Always pass the full document as context when using Claude Code or Codex, and reference specific section numbers when requesting implementation.*

*Key additions in v4.2.0: In-app notification system (§10) with SSE real-time delivery + VAPID Web Push to installed PWA devices. PWA configuration (§11) with serwist service worker, web app manifest, offline caching, install prompt, and push notification handling. Notification models (`Notification`, `NotificationRead`, `PushSubscription`) added to DB schema (§6). Landing page UI/UX designed referencing menurite.app.*
