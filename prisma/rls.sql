-- Row-Level Security (defense-in-depth tenant isolation)
-- =========================================================
--
-- This project doesn't use `prisma migrate` (schema changes go through
-- `bun prisma db push`), so this is a standalone, reviewable SQL script
-- rather than a numbered migration — apply it manually against the
-- database (e.g. via `psql "$DATABASE_URL" -f prisma/rls.sql` or a Neon
-- SQL console) once you've reviewed it.
--
-- WHAT THIS DOES
-- Every tenant-scoped table gets RLS enabled with a policy that only
-- allows rows whose (direct or joined) `restaurantId` matches the
-- Postgres session variable `app.current_restaurant_id`. The app itself
-- does NOT set that variable anywhere — it doesn't need to, because
-- every query in the codebase is already scoped by `restaurantId` at the
-- Prisma/application layer (confirmed by audit). This migration exists so
-- that if the database is ever reached by any OTHER connection that isn't
-- the app's own trusted role — a BI tool, a read replica, a future
-- internal service, a misconfigured script — that connection sees zero
-- rows by default instead of the entire multi-tenant dataset.
--
-- WHAT THIS DOES NOT DO
-- It does not change any application code, any query, or any behavior of
-- the running app. The app's own database role is granted BYPASSRLS below
-- so its existing queries continue to work exactly as they do today.
--
-- CAVEAT
-- `ALTER ROLE CURRENT_USER WITH BYPASSRLS` requires the role to have
-- permission to alter itself. On some managed Postgres providers this
-- must instead be run by an admin/superuser role naming the app's role
-- explicitly, e.g.: `ALTER ROLE your_app_role WITH BYPASSRLS;`
-- If this statement fails, run that form instead via your provider's
-- admin console (e.g. Neon's SQL editor as the project owner).

-- ─── Directly tenant-scoped tables (have a restaurantId column) ───────

ALTER TABLE "MenuCategory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MenuCategory" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "MenuCategory"
	USING ("restaurantId" = current_setting('app.current_restaurant_id', true))
	WITH CHECK ("restaurantId" = current_setting('app.current_restaurant_id', true));

ALTER TABLE "Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Order" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Order"
	USING ("restaurantId" = current_setting('app.current_restaurant_id', true))
	WITH CHECK ("restaurantId" = current_setting('app.current_restaurant_id', true));

ALTER TABLE "TableSeat" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TableSeat" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "TableSeat"
	USING ("restaurantId" = current_setting('app.current_restaurant_id', true))
	WITH CHECK ("restaurantId" = current_setting('app.current_restaurant_id', true));

ALTER TABLE "Reservation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Reservation" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Reservation"
	USING ("restaurantId" = current_setting('app.current_restaurant_id', true))
	WITH CHECK ("restaurantId" = current_setting('app.current_restaurant_id', true));

ALTER TABLE "ReservationSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ReservationSetting" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ReservationSetting"
	USING ("restaurantId" = current_setting('app.current_restaurant_id', true))
	WITH CHECK ("restaurantId" = current_setting('app.current_restaurant_id', true));

ALTER TABLE "StaffMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffMember" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "StaffMember"
	USING ("restaurantId" = current_setting('app.current_restaurant_id', true))
	WITH CHECK ("restaurantId" = current_setting('app.current_restaurant_id', true));

ALTER TABLE "Rating" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Rating" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Rating"
	USING ("restaurantId" = current_setting('app.current_restaurant_id', true))
	WITH CHECK ("restaurantId" = current_setting('app.current_restaurant_id', true));

ALTER TABLE "ScanEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScanEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "ScanEvent"
	USING ("restaurantId" = current_setting('app.current_restaurant_id', true))
	WITH CHECK ("restaurantId" = current_setting('app.current_restaurant_id', true));

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Notification" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "Notification"
	USING ("restaurantId" = current_setting('app.current_restaurant_id', true))
	WITH CHECK ("restaurantId" = current_setting('app.current_restaurant_id', true));

ALTER TABLE "PushSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PushSubscription" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "PushSubscription"
	USING ("restaurantId" = current_setting('app.current_restaurant_id', true))
	WITH CHECK ("restaurantId" = current_setting('app.current_restaurant_id', true));

ALTER TABLE "RestaurantBankAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RestaurantBankAccount" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "RestaurantBankAccount"
	USING ("restaurantId" = current_setting('app.current_restaurant_id', true))
	WITH CHECK ("restaurantId" = current_setting('app.current_restaurant_id', true));

ALTER TABLE "RestaurantBanner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RestaurantBanner" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "RestaurantBanner"
	USING ("restaurantId" = current_setting('app.current_restaurant_id', true))
	WITH CHECK ("restaurantId" = current_setting('app.current_restaurant_id', true));

-- ─── Indirectly tenant-scoped tables (join up to find restaurantId) ───

ALTER TABLE "MenuItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "MenuItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "MenuItem"
	USING (
		EXISTS (
			SELECT 1 FROM "MenuCategory"
			WHERE "MenuCategory".id = "MenuItem"."categoryId"
			AND "MenuCategory"."restaurantId" = current_setting('app.current_restaurant_id', true)
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM "MenuCategory"
			WHERE "MenuCategory".id = "MenuItem"."categoryId"
			AND "MenuCategory"."restaurantId" = current_setting('app.current_restaurant_id', true)
		)
	);

ALTER TABLE "OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderItem" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OrderItem"
	USING (
		EXISTS (
			SELECT 1 FROM "Order"
			WHERE "Order".id = "OrderItem"."orderId"
			AND "Order"."restaurantId" = current_setting('app.current_restaurant_id', true)
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM "Order"
			WHERE "Order".id = "OrderItem"."orderId"
			AND "Order"."restaurantId" = current_setting('app.current_restaurant_id', true)
		)
	);

ALTER TABLE "OrderPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderPayment" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OrderPayment"
	USING (
		EXISTS (
			SELECT 1 FROM "Order"
			WHERE "Order".id = "OrderPayment"."orderId"
			AND "Order"."restaurantId" = current_setting('app.current_restaurant_id', true)
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM "Order"
			WHERE "Order".id = "OrderPayment"."orderId"
			AND "Order"."restaurantId" = current_setting('app.current_restaurant_id', true)
		)
	);

ALTER TABLE "OrderEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrderEvent" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "OrderEvent"
	USING (
		EXISTS (
			SELECT 1 FROM "Order"
			WHERE "Order".id = "OrderEvent"."orderId"
			AND "Order"."restaurantId" = current_setting('app.current_restaurant_id', true)
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM "Order"
			WHERE "Order".id = "OrderEvent"."orderId"
			AND "Order"."restaurantId" = current_setting('app.current_restaurant_id', true)
		)
	);

ALTER TABLE "NotificationRead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationRead" FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "NotificationRead"
	USING (
		EXISTS (
			SELECT 1 FROM "Notification"
			WHERE "Notification".id = "NotificationRead"."notificationId"
			AND "Notification"."restaurantId" = current_setting('app.current_restaurant_id', true)
		)
	)
	WITH CHECK (
		EXISTS (
			SELECT 1 FROM "Notification"
			WHERE "Notification".id = "NotificationRead"."notificationId"
			AND "Notification"."restaurantId" = current_setting('app.current_restaurant_id', true)
		)
	);

-- ─── App's own connection: bypass RLS (queries already scoped in code) ─

ALTER ROLE CURRENT_USER WITH BYPASSRLS;

-- NOTE: `Restaurant` itself is intentionally NOT given RLS here — it's the
-- tenant root, looked up by public customer routes via `slug` before any
-- tenant context exists (that lookup IS how the tenant gets identified).
-- `User`/`Session`/`Account`/`Verification` (better-auth), `Plan` (global
-- platform data), and `Subscription`/`CustomerProfile`/`CustomerOtp` are
-- also out of scope for this pass — they aren't scoped by `restaurantId`
-- the same way, and adding policies for them would need separate design.
