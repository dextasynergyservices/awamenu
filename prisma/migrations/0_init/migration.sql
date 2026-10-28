-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('RESTAURANT_OWNER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "PlanTier" AS ENUM ('FREE', 'STARTER', 'PRO');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELLED', 'TRIALING');

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('PENDING_PLAN', 'PENDING_PAYMENT', 'PENDING_SETUP', 'COMPLETE');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'PICKUP', 'DELIVERY', 'TABLE_RESERVATION');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_APPROVAL', 'PENDING_PAYMENT', 'CONFIRMED', 'PREPARING', 'READY', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "DineInPaymentMethod" AS ENUM ('CASH', 'TRANSFER_OR_CARD');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'POS', 'TRANSFER', 'PAYSTACK');

-- CreateEnum
CREATE TYPE "DineInServiceMode" AS ENUM ('SELF_SERVED', 'SERVED_BY_WAITER');

-- CreateEnum
CREATE TYPE "PaymentPolicy" AS ENUM ('PAY_BEFORE_SERVICE', 'PAY_AFTER_SERVICE', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "CustomerUpdateChannel" AS ENUM ('WHATSAPP', 'SMS', 'NONE');

-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'CHECKED_IN', 'COMPLETED', 'EXPIRED', 'CANCELLED', 'DECLINED');

-- CreateEnum
CREATE TYPE "TableBookingMode" AS ENUM ('FREE_BOOKING', 'ORDER_REQUIRED', 'DEPOSIT_REQUIRED', 'FULL_PAYMENT');

-- CreateEnum
CREATE TYPE "TablePaymentTiming" AS ENUM ('PAY_ON_BOOKING', 'PAY_ON_ARRIVAL', 'PAY_AFTER_SERVICE');

-- CreateEnum
CREATE TYPE "TableInclusionType" AS ENUM ('TABLE_FEE_ONLY', 'FOOD_ONLY', 'FOOD_AND_TABLE_FEE');

-- CreateEnum
CREATE TYPE "RatingContext" AS ENUM ('DINE_IN', 'DELIVERY', 'PICKUP', 'RESERVATION');

-- CreateEnum
CREATE TYPE "NotificationAudience" AS ENUM ('ADMIN', 'STAFF', 'BOTH');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('NEW_ORDER', 'ORDER_STATUS_CHANGED', 'ORDER_CANCELLED', 'NEW_RESERVATION', 'RESERVATION_CANCELLED', 'RESERVATION_EXPIRED', 'PAYMENT_RECEIVED', 'LOW_STOCK_ALERT');

-- CreateEnum
CREATE TYPE "PaymentAttemptKind" AS ENUM ('ORDER', 'RESERVATION', 'SUBSCRIPTION');

-- CreateEnum
CREATE TYPE "PaymentAttemptStatus" AS ENUM ('PENDING', 'SETTLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PaymentChannel" AS ENUM ('AWAMENU_PAY', 'OWN_GATEWAY', 'BANK_TRANSFER', 'CASH');

-- CreateEnum
CREATE TYPE "PaymentGateway" AS ENUM ('PAYSTACK', 'FLUTTERWAVE', 'MONNIFY');

-- CreateEnum
CREATE TYPE "PaymentDirection" AS ENUM ('CREDIT', 'REFUND');

-- CreateEnum
CREATE TYPE "LedgerEntryStatus" AS ENUM ('SUCCESS', 'MISMATCH', 'REVERSED');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'SETTLED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "AuditActorType" AS ENUM ('OWNER', 'STAFF', 'SUPER_ADMIN', 'SYSTEM', 'CUSTOMER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "name" TEXT,
    "image" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'RESTAURANT_OWNER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "suspensionReason" TEXT,
    "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'PENDING_PLAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffMember" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "canHandleDineIn" BOOLEAN,
    "canHandlePickup" BOOLEAN,
    "canHandleDelivery" BOOLEAN,
    "canRecordCashPayment" BOOLEAN,
    "canApproveReservations" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "tier" "PlanTier" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "monthlyPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "quarterlyPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "yearlyPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "maxCategories" INTEGER NOT NULL DEFAULT 1,
    "maxTables" INTEGER NOT NULL DEFAULT 1,
    "maxMenuItems" INTEGER NOT NULL DEFAULT 8,
    "advancedAnalytics" BOOLEAN NOT NULL DEFAULT false,
    "removeAwamenuBranding" BOOLEAN NOT NULL DEFAULT false,
    "whatsappIntegration" BOOLEAN NOT NULL DEFAULT true,
    "prioritySupport" BOOLEAN NOT NULL DEFAULT false,
    "basicSupport" BOOLEAN NOT NULL DEFAULT false,
    "availableTemplates" TEXT[] DEFAULT ARRAY['classic']::TEXT[],
    "paystackPlanCode" TEXT,
    "paystackMonthlyPlanCode" TEXT,
    "paystackQuarterlyPlanCode" TEXT,
    "paystackYearlyPlanCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "originalPlanId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'TRIALING',
    "billingInterval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
    "currentPeriodStart" TIMESTAMP(3) NOT NULL,
    "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
    "paystackSubscriptionCode" TEXT,
    "paystackCustomerCode" TEXT,
    "paymentRef" TEXT,
    "lastExpiryNoticeStage" TEXT,
    "restaurantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionPayment" (
    "id" TEXT NOT NULL,
    "gateway" "PaymentGateway" NOT NULL DEFAULT 'PAYSTACK',
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "restaurantId" TEXT,
    "subscriptionId" TEXT,
    "billingInterval" "BillingInterval" NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "expectedAmount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "LedgerEntryStatus" NOT NULL,
    "note" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentAttempt" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "providerReference" TEXT,
    "gateway" "PaymentGateway" NOT NULL,
    "ownGateway" BOOLEAN NOT NULL DEFAULT false,
    "kind" "PaymentAttemptKind" NOT NULL,
    "status" "PaymentAttemptStatus" NOT NULL DEFAULT 'PENDING',
    "amountKobo" INTEGER NOT NULL,
    "orderId" TEXT,
    "reservationId" TEXT,
    "restaurantId" TEXT,
    "userId" TEXT,
    "planId" TEXT,
    "billingInterval" "BillingInterval",
    "checkCount" INTEGER NOT NULL DEFAULT 0,
    "lastCheckedAt" TIMESTAMP(3),
    "settledAt" TIMESTAMP(3),
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Restaurant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos',
    "whatsappNumber" TEXT,
    "customerUpdateChannel" "CustomerUpdateChannel" NOT NULL DEFAULT 'WHATSAPP',
    "setupChecklistDismissedAt" TIMESTAMP(3),
    "dineInEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true,
    "tableReservationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tablesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "dineInPaymentPolicy" "PaymentPolicy" NOT NULL DEFAULT 'PAY_BEFORE_SERVICE',
    "staffDefaultDineIn" BOOLEAN NOT NULL DEFAULT true,
    "staffDefaultPickup" BOOLEAN NOT NULL DEFAULT false,
    "staffDefaultDelivery" BOOLEAN NOT NULL DEFAULT false,
    "staffDefaultCashPayment" BOOLEAN NOT NULL DEFAULT true,
    "staffDefaultApproveReservations" BOOLEAN NOT NULL DEFAULT false,
    "staffDashboardPassword" TEXT,
    "staffDashboardAutoLockHours" INTEGER NOT NULL DEFAULT 24,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "primaryColor" TEXT,
    "fontFamily" TEXT,
    "activeTemplate" TEXT NOT NULL DEFAULT 'classic',
    "ownerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Restaurant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantPaymentMethod" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "channel" "PaymentChannel" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "gateway" "PaymentGateway",
    "publicKey" TEXT,
    "secretKeyEncrypted" TEXT,
    "contractCode" TEXT,
    "lastVerifiedAt" TIMESTAMP(3),
    "bankCode" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "accountName" TEXT,
    "subaccountCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantPaymentMethod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantBlackoutDate" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantBlackoutDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantOpeningHour" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "opensAt" TEXT NOT NULL,
    "closesAt" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantOpeningHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantPayoutAccount" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "gateway" "PaymentGateway" NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "subaccountCode" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantPayoutAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantBankAccount" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantBankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantBanner" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "title" TEXT,
    "subtitle" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestaurantBanner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuCategory" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "hiddenByDowngrade" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MenuItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "imageUrl" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isTodaySpecial" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "newOrderEmailSentAt" TIMESTAMP(3),
    "confirmationEmailSentAt" TIMESTAMP(3),
    "receiptEmailSentAt" TIMESTAMP(3),
    "completionEmailSentAt" TIMESTAMP(3),
    "cancellationEmailSentAt" TIMESTAMP(3),
    "type" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'CONFIRMED',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentRef" TEXT,
    "paymentProvider" TEXT,
    "tableNumber" TEXT,
    "tableId" TEXT,
    "tableLabel" TEXT,
    "dineInPaymentPolicy" "PaymentPolicy",
    "dineInPaymentMethod" "DineInPaymentMethod",
    "dineInServiceMode" "DineInServiceMode",
    "waiterName" TEXT,
    "dineInAmountPaid" DECIMAL(10,2),
    "dineInPaymentRecordedAt" TIMESTAMP(3),
    "dineInPaidMethod" "DineInPaymentMethod",
    "attendingStaffId" TEXT,
    "deliveryAddress" TEXT,
    "deliveryNotes" TEXT,
    "statusNote" TEXT,
    "orderFor" TEXT,
    "senderPhone" TEXT,
    "senderTableNumber" TEXT,
    "receiverPhone" TEXT,
    "receiverAltPhone" TEXT,
    "receiverName" TEXT,
    "seatNumber" TEXT,
    "deliveryFee" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "whatsappNotified" BOOLEAN NOT NULL DEFAULT false,
    "whatsappNotifiedAt" TIMESTAMP(3),
    "cancelledById" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancellationNote" TEXT,
    "refundRequiredReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderMessage" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL,
    "channel" "CustomerUpdateChannel" NOT NULL,
    "providerRef" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "menuItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "qty" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderPayment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "direction" "PaymentDirection" NOT NULL DEFAULT 'CREDIT',
    "status" "LedgerEntryStatus" NOT NULL DEFAULT 'SUCCESS',
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "gateway" "PaymentGateway",
    "expectedAmount" DECIMAL(10,2),
    "gatewayFee" DECIMAL(10,2),
    "platformFee" DECIMAL(10,2),
    "netToRestaurant" DECIMAL(10,2),
    "subaccountCode" TEXT,
    "settlementStatus" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
    "settledAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "note" TEXT,

    CONSTRAINT "OrderPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestaurantAuditEvent" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "actorType" "AuditActorType" NOT NULL,
    "actorId" TEXT,
    "actorName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "previousValue" TEXT,
    "newValue" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RestaurantAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservationSetting" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "advanceBookingHours" INTEGER NOT NULL DEFAULT 0,
    "slotIntervalMinutes" INTEGER NOT NULL DEFAULT 30,
    "graceMinutes" INTEGER NOT NULL DEFAULT 15,
    "paymentWindowMinutes" INTEGER NOT NULL DEFAULT 120,
    "autoConfirmFreeBookings" BOOLEAN NOT NULL DEFAULT false,
    "cancellationPolicy" TEXT,
    "refundPolicy" TEXT,
    "bookingDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TableSeat" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "capacity" INTEGER NOT NULL DEFAULT 2,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "bookingMode" "TableBookingMode" NOT NULL DEFAULT 'FREE_BOOKING',
    "paymentTiming" "TablePaymentTiming" NOT NULL DEFAULT 'PAY_ON_ARRIVAL',
    "inclusionType" "TableInclusionType" NOT NULL DEFAULT 'TABLE_FEE_ONLY',
    "holdMinutes" INTEGER NOT NULL DEFAULT 60,
    "minPartySize" INTEGER NOT NULL DEFAULT 1,
    "maxPartySize" INTEGER NOT NULL DEFAULT 0,
    "depositPercent" INTEGER NOT NULL DEFAULT 0,
    "tableFee" DECIMAL(10,2),
    "minimumSpend" DECIMAL(10,2),

    CONSTRAINT "TableSeat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Reservation" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "tableId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "customerEmail" TEXT,
    "partySize" INTEGER NOT NULL DEFAULT 1,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
    "qstashMessageId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "effectiveBookingMode" "TableBookingMode" NOT NULL,
    "effectivePaymentTiming" "TablePaymentTiming" NOT NULL,
    "effectiveInclusionType" "TableInclusionType" NOT NULL,
    "effectiveDepositPercent" INTEGER NOT NULL DEFAULT 0,
    "effectiveTableFee" DECIMAL(10,2),
    "reservationPaymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "reservationPaymentRef" TEXT,
    "reservationAmountPaid" DECIMAL(10,2),
    "paymentDueAt" TIMESTAMP(3),
    "refundRequiredReason" TEXT,
    "preOrderId" TEXT,
    "specialRequests" TEXT,
    "requestedEmailSentAt" TIMESTAMP(3),
    "approvedEmailSentAt" TIMESTAMP(3),
    "confirmedEmailSentAt" TIMESTAMP(3),
    "declinedEmailSentAt" TIMESTAMP(3),
    "cancelledEmailSentAt" TIMESTAMP(3),
    "reminderEmailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reservation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "fullName" TEXT,
    "whatsappNumber" TEXT,
    "alternativePhone" TEXT,
    "email" TEXT,
    "deliveryAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerOtp" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "audience" "NotificationAudience" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationRead" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "recipientType" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "staffMemberId" TEXT,
    "restaurantId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rating" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "orderId" TEXT,
    "reservationId" TEXT,
    "context" "RatingContext" NOT NULL,
    "foodQuality" INTEGER,
    "deliverySpeed" INTEGER,
    "packaging" INTEGER,
    "serviceQuality" INTEGER,
    "ambiance" INTEGER,
    "valueForMoney" INTEGER,
    "overallRating" INTEGER NOT NULL,
    "comment" TEXT,
    "isHidden" BOOLEAN NOT NULL DEFAULT false,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Rating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScanEvent" (
    "id" TEXT NOT NULL,
    "restaurantId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userAgent" TEXT,
    "country" TEXT,

    CONSTRAINT "ScanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "staffId" TEXT,
    "isAutomatic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "adminId" TEXT NOT NULL,
    "adminName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'success',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSetting" (
    "id" TEXT NOT NULL,
    "platformName" TEXT NOT NULL DEFAULT 'AwaMenu',
    "logoUrl" TEXT,
    "paystackPublicKey" TEXT,
    "paystackSecretKey" TEXT,
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "awamenuPayCommissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "enabledPaymentChannels" "PaymentChannel"[] DEFAULT ARRAY['AWAMENU_PAY', 'OWN_GATEWAY', 'BANK_TRANSFER', 'CASH']::"PaymentChannel"[],
    "awamenuPayProviders" "PaymentGateway"[] DEFAULT ARRAY['PAYSTACK', 'MONNIFY']::"PaymentGateway"[],
    "ownGatewayProviders" "PaymentGateway"[] DEFAULT ARRAY['PAYSTACK', 'FLUTTERWAVE', 'MONNIFY']::"PaymentGateway"[],
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_accountId_key" ON "Account"("provider", "accountId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "StaffMember_staffId_key" ON "StaffMember"("staffId");

-- CreateIndex
CREATE INDEX "StaffMember_restaurantId_idx" ON "StaffMember"("restaurantId");

-- CreateIndex
CREATE INDEX "StaffMember_staffId_idx" ON "StaffMember"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_tier_key" ON "Plan"("tier");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_restaurantId_key" ON "Subscription"("restaurantId");

-- CreateIndex
CREATE INDEX "Subscription_userId_idx" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "Subscription_restaurantId_idx" ON "Subscription"("restaurantId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_userId_idx" ON "SubscriptionPayment"("userId");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_restaurantId_createdAt_idx" ON "SubscriptionPayment"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "SubscriptionPayment_createdAt_idx" ON "SubscriptionPayment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionPayment_gateway_reference_key" ON "SubscriptionPayment"("gateway", "reference");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentAttempt_reference_key" ON "PaymentAttempt"("reference");

-- CreateIndex
CREATE INDEX "PaymentAttempt_status_createdAt_idx" ON "PaymentAttempt"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PaymentAttempt_orderId_idx" ON "PaymentAttempt"("orderId");

-- CreateIndex
CREATE INDEX "PaymentAttempt_reservationId_idx" ON "PaymentAttempt"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "Restaurant_slug_key" ON "Restaurant"("slug");

-- CreateIndex
CREATE INDEX "Restaurant_slug_idx" ON "Restaurant"("slug");

-- CreateIndex
CREATE INDEX "Restaurant_ownerId_idx" ON "Restaurant"("ownerId");

-- CreateIndex
CREATE INDEX "RestaurantPaymentMethod_restaurantId_idx" ON "RestaurantPaymentMethod"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantPaymentMethod_restaurantId_channel_key" ON "RestaurantPaymentMethod"("restaurantId", "channel");

-- CreateIndex
CREATE INDEX "RestaurantBlackoutDate_restaurantId_idx" ON "RestaurantBlackoutDate"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantBlackoutDate_restaurantId_date_key" ON "RestaurantBlackoutDate"("restaurantId", "date");

-- CreateIndex
CREATE INDEX "RestaurantOpeningHour_restaurantId_dayOfWeek_idx" ON "RestaurantOpeningHour"("restaurantId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "RestaurantPayoutAccount_restaurantId_idx" ON "RestaurantPayoutAccount"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "RestaurantPayoutAccount_restaurantId_gateway_key" ON "RestaurantPayoutAccount"("restaurantId", "gateway");

-- CreateIndex
CREATE INDEX "RestaurantBankAccount_restaurantId_idx" ON "RestaurantBankAccount"("restaurantId");

-- CreateIndex
CREATE INDEX "RestaurantBanner_restaurantId_idx" ON "RestaurantBanner"("restaurantId");

-- CreateIndex
CREATE INDEX "MenuCategory_restaurantId_idx" ON "MenuCategory"("restaurantId");

-- CreateIndex
CREATE INDEX "MenuItem_categoryId_idx" ON "MenuItem"("categoryId");

-- CreateIndex
CREATE INDEX "Order_restaurantId_idx" ON "Order"("restaurantId");

-- CreateIndex
CREATE INDEX "Order_customerPhone_idx" ON "Order"("customerPhone");

-- CreateIndex
CREATE INDEX "Order_paymentRef_idx" ON "Order"("paymentRef");

-- CreateIndex
CREATE INDEX "Order_attendingStaffId_idx" ON "Order"("attendingStaffId");

-- CreateIndex
CREATE INDEX "OrderMessage_orderId_idx" ON "OrderMessage"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "OrderMessage_orderId_status_key" ON "OrderMessage"("orderId", "status");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderPayment_orderId_idx" ON "OrderPayment"("orderId");

-- CreateIndex
CREATE INDEX "OrderPayment_restaurantId_createdAt_idx" ON "OrderPayment"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderPayment_settlementStatus_idx" ON "OrderPayment"("settlementStatus");

-- CreateIndex
CREATE UNIQUE INDEX "OrderPayment_gateway_reference_key" ON "OrderPayment"("gateway", "reference");

-- CreateIndex
CREATE INDEX "RestaurantAuditEvent_restaurantId_createdAt_idx" ON "RestaurantAuditEvent"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "RestaurantAuditEvent_restaurantId_action_idx" ON "RestaurantAuditEvent"("restaurantId", "action");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationSetting_restaurantId_key" ON "ReservationSetting"("restaurantId");

-- CreateIndex
CREATE INDEX "TableSeat_restaurantId_idx" ON "TableSeat"("restaurantId");

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_preOrderId_key" ON "Reservation"("preOrderId");

-- CreateIndex
CREATE INDEX "Reservation_restaurantId_idx" ON "Reservation"("restaurantId");

-- CreateIndex
CREATE INDEX "Reservation_tableId_status_startsAt_idx" ON "Reservation"("tableId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "Reservation_status_paymentDueAt_idx" ON "Reservation"("status", "paymentDueAt");

-- CreateIndex
CREATE INDEX "Reservation_status_expiresAt_idx" ON "Reservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "Reservation_startsAt_idx" ON "Reservation"("startsAt");

-- CreateIndex
CREATE INDEX "Reservation_customerPhone_idx" ON "Reservation"("customerPhone");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_whatsappNumber_key" ON "CustomerProfile"("whatsappNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_email_key" ON "CustomerProfile"("email");

-- CreateIndex
CREATE INDEX "CustomerProfile_whatsappNumber_idx" ON "CustomerProfile"("whatsappNumber");

-- CreateIndex
CREATE INDEX "CustomerProfile_email_idx" ON "CustomerProfile"("email");

-- CreateIndex
CREATE INDEX "CustomerOtp_identifier_createdAt_idx" ON "CustomerOtp"("identifier", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_restaurantId_createdAt_idx" ON "Notification"("restaurantId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_restaurantId_audience_idx" ON "Notification"("restaurantId", "audience");

-- CreateIndex
CREATE INDEX "NotificationRead_recipientType_recipientId_idx" ON "NotificationRead"("recipientType", "recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationRead_notificationId_recipientType_recipientId_key" ON "NotificationRead"("notificationId", "recipientType", "recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "PushSubscription_restaurantId_idx" ON "PushSubscription"("restaurantId");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE INDEX "PushSubscription_staffMemberId_idx" ON "PushSubscription"("staffMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_orderId_key" ON "Rating"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Rating_reservationId_key" ON "Rating"("reservationId");

-- CreateIndex
CREATE INDEX "Rating_restaurantId_idx" ON "Rating"("restaurantId");

-- CreateIndex
CREATE INDEX "ScanEvent_restaurantId_scannedAt_idx" ON "ScanEvent"("restaurantId", "scannedAt");

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_idx" ON "OrderEvent"("orderId");

-- CreateIndex
CREATE INDEX "OrderEvent_staffId_idx" ON "OrderEvent"("staffId");

-- CreateIndex
CREATE INDEX "AuditLog_adminId_idx" ON "AuditLog"("adminId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RateLimit_key_key" ON "RateLimit"("key");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffMember" ADD CONSTRAINT "StaffMember_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Restaurant" ADD CONSTRAINT "Restaurant_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantPaymentMethod" ADD CONSTRAINT "RestaurantPaymentMethod_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantBlackoutDate" ADD CONSTRAINT "RestaurantBlackoutDate_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantOpeningHour" ADD CONSTRAINT "RestaurantOpeningHour_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantPayoutAccount" ADD CONSTRAINT "RestaurantPayoutAccount_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantBankAccount" ADD CONSTRAINT "RestaurantBankAccount_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantBanner" ADD CONSTRAINT "RestaurantBanner_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuCategory" ADD CONSTRAINT "MenuCategory_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MenuItem" ADD CONSTRAINT "MenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableSeat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_attendingStaffId_fkey" FOREIGN KEY ("attendingStaffId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderMessage" ADD CONSTRAINT "OrderMessage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderPayment" ADD CONSTRAINT "OrderPayment_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RestaurantAuditEvent" ADD CONSTRAINT "RestaurantAuditEvent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservationSetting" ADD CONSTRAINT "ReservationSetting_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TableSeat" ADD CONSTRAINT "TableSeat_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "TableSeat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_preOrderId_fkey" FOREIGN KEY ("preOrderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationRead" ADD CONSTRAINT "NotificationRead_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_staffMemberId_fkey" FOREIGN KEY ("staffMemberId") REFERENCES "StaffMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rating" ADD CONSTRAINT "Rating_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScanEvent" ADD CONSTRAINT "ScanEvent_restaurantId_fkey" FOREIGN KEY ("restaurantId") REFERENCES "Restaurant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Reservation integrity (not expressible in schema.prisma) ───────────
-- WHY A CONSTRAINT AND NOT JUST A CHECK IN CODE
-- The app checks for an overlapping booking before it writes one. Two guests
-- pressing "Book" for the same table at the same moment both pass that check
-- (neither can see the other's uncommitted row) and both get the table. Only
-- the database sees every write, so only the database can refuse the second.
-- With this in place the race has a defined loser: their INSERT/UPDATE fails
-- with SQLSTATE 23P01, which the app turns into "this table was just taken".
--
-- WHAT COUNTS AS HOLDING A TABLE
--   APPROVED    approved and awaiting payment (until paymentDueAt)
--   ACTIVE      confirmed / paid
--   CHECKED_IN  the guest is seated
-- PENDING_APPROVAL deliberately does not hold the table: an unpaid request
-- costs nothing to make, so letting it block a slot would let anyone lock every
-- table with fake requests. The restaurant resolves competing requests when it
-- approves one, and the second approval is refused by this constraint.
--
-- The range is [startsAt, expiresAt): the booking length plus the grace window.
-- Half-open, so a booking ending at 20:00 and one starting at 20:00 do not clash.

CREATE EXTENSION IF NOT EXISTS btree_gist;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'reservation_no_overlap'
	) THEN
		ALTER TABLE "Reservation"
			ADD CONSTRAINT reservation_no_overlap
			EXCLUDE USING gist (
				"tableId" WITH =,
				tsrange("startsAt", "expiresAt", '[)') WITH &&
			)
			WHERE (status IN ('APPROVED', 'ACTIVE', 'CHECKED_IN'));
	END IF;
END
$$;

-- A booking that ends before it starts would slip past the overlap rule.
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint WHERE conname = 'reservation_valid_range'
	) THEN
		ALTER TABLE "Reservation"
			ADD CONSTRAINT reservation_valid_range
			CHECK ("expiresAt" > "startsAt");
	END IF;
END
$$;
