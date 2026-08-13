import {
	type LedgerEntryStatus,
	OrderStatus,
	type PaymentGateway,
	type PaymentMethod,
	PaymentStatus,
	Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";

/**
 * The one place an order is ever marked paid.
 *
 * Before this existed, six independent paths set `paymentStatus: PAID` — two
 * webhook branches, two verify branches, the admin dine-in confirm and the
 * staff payment form — and only one of them wrote a payment row at all. Card
 * payments therefore left no financial record whatsoever, so no report could
 * ever be trusted, and each path re-implemented (or forgot) the checks.
 *
 * Everything now funnels through `creditOrder`. Three properties it guarantees
 * that the old paths did not:
 *
 * 1. **The amount is checked.** A gateway saying "success" is not the same as
 *    the right money arriving. A mismatch is recorded and refused, never
 *    silently credited.
 * 2. **Crediting is idempotent.** Providers retry webhooks, and the customer's
 *    browser hits the verify endpoint at the same moment. The unique index on
 *    (gateway, reference) makes a double credit impossible in the database
 *    rather than merely unlikely in the code.
 * 3. **Paid means fully paid.** Status is derived from the sum of the ledger,
 *    so a part payment leaves the order owing the balance instead of a
 *    staff-typed figure marking a half-paid order settled.
 */

/** Money confirmed by a payment provider. */
export type GatewayCredit = {
	kind: "GATEWAY";
	gateway: PaymentGateway;
	reference: string;
	/** As the provider reported it, in minor units (kobo). */
	paidMinorUnits: number;
	/**
	 * What this particular charge was meant to collect, in minor units.
	 *
	 * Defaults to the whole order. A reservation deposit sets it to the deposit,
	 * so a legitimate part payment is not mistaken for an underpayment — the
	 * order simply keeps an outstanding balance until the rest arrives.
	 */
	expectedMinorUnits?: number | null;
	currency: string;
	/** The provider's own fee, in minor units, when it reports one. */
	gatewayFeeMinorUnits?: number | null;
	subaccountCode?: string | null;
	/** True when the restaurant used their own gateway keys, so AwaMenu takes
	 *  no commission and the money never routed through a subaccount. */
	ownGateway?: boolean;
	rawPayload?: unknown;
};

/** Cash, POS or bank transfer taken in person and typed in by a human. */
export type ManualCredit = {
	kind: "MANUAL";
	method: PaymentMethod;
	/** In naira, as entered. */
	amount: number;
	recordedById?: string | null;
	reference?: string | null;
	note?: string | null;
};

export type CreditSource = GatewayCredit | ManualCredit;

export type CreditResult =
	| {
			ok: true;
			/** False when this call is what settled the order — the caller uses
			 *  this to decide whether to send receipts, so retries stay silent. */
			newlyPaid: boolean;
			/** Total credited so far, in naira. */
			amountPaid: number;
			/** Still owing, in naira. Zero once settled. */
			outstanding: number;
	  }
	| {
			ok: false;
			reason: "ORDER_NOT_FOUND" | "AMOUNT_MISMATCH" | "CURRENCY_MISMATCH";
			message: string;
	  };

const toNaira = (minorUnits: number) => minorUnits / 100;

/** Decimal comparison via Prisma.Decimal — never via JS floats, which cannot
 *  represent common money values exactly. */
const dec = (value: Prisma.Decimal | number) => new Prisma.Decimal(value);

/**
 * What AwaMenu keeps from a payment, worked out at the moment it lands.
 *
 * Deliberately not derived on read: the commission percentage is a platform
 * setting that will change, and a report that recalculates two-year-old
 * payments at today's rate reports numbers that were never true.
 */
async function resolveSplit(source: GatewayCredit, gross: number) {
	const gatewayFee =
		source.gatewayFeeMinorUnits != null
			? toNaira(source.gatewayFeeMinorUnits)
			: null;

	// A restaurant on their own keys is billed directly by their provider and
	// AwaMenu is not in the flow at all, so there is nothing to take.
	if (source.ownGateway) {
		return {
			gatewayFee,
			platformFee: 0,
			netToRestaurant: gross - (gatewayFee ?? 0),
		};
	}

	const settings = await db.platformSetting.findFirst({
		select: { awamenuPayCommissionPercent: true },
	});
	const commissionPercent = Number(settings?.awamenuPayCommissionPercent ?? 0);
	const platformFee =
		Math.round(((gross * commissionPercent) / 100) * 100) / 100;

	return {
		gatewayFee,
		platformFee,
		netToRestaurant: gross - (gatewayFee ?? 0) - platformFee,
	};
}

/**
 * Records money against an order and settles it once fully covered.
 *
 * Notifications are deliberately left to the caller. Sending inside this
 * function would put network calls in the same path as the write, and an email
 * provider timing out must never be able to lose a payment record.
 */
export async function creditOrder(
	orderId: string,
	source: CreditSource,
): Promise<CreditResult> {
	const order = await db.order.findUnique({
		where: { id: orderId },
		select: {
			id: true,
			restaurantId: true,
			total: true,
			status: true,
			paymentStatus: true,
		},
	});

	if (!order) {
		return {
			ok: false,
			reason: "ORDER_NOT_FOUND",
			message: "That order no longer exists.",
		};
	}

	const expected = dec(order.total);

	let entryAmount: Prisma.Decimal;
	let entryStatus: LedgerEntryStatus = "SUCCESS";
	let mismatchMessage: string | null = null;

	if (source.kind === "GATEWAY") {
		if (source.currency.toUpperCase() !== "NGN") {
			// Recorded rather than dropped: a payment in the wrong currency is a
			// configuration fault someone has to see, and the customer has
			// genuinely been charged.
			await recordEntry(order, source, dec(toNaira(source.paidMinorUnits)), {
				status: "MISMATCH",
				note: `Paid in ${source.currency}, expected NGN`,
			});
			return {
				ok: false,
				reason: "CURRENCY_MISMATCH",
				message: `Payment came through in ${source.currency} but the order is priced in NGN.`,
			};
		}

		entryAmount = dec(toNaira(source.paidMinorUnits));

		const shouldHavePaid =
			source.expectedMinorUnits != null
				? dec(toNaira(source.expectedMinorUnits))
				: expected;

		// Underpayment is the attack: initialise a charge, tamper with the
		// amount, receive a fully-paid order. Overpayment is recorded as-is —
		// the money is genuinely theirs and refusing it helps nobody.
		if (entryAmount.lessThan(shouldHavePaid)) {
			entryStatus = "MISMATCH";
			mismatchMessage = `Paid ₦${entryAmount.toFixed(2)} against ₦${shouldHavePaid.toFixed(2)} due.`;
		}
	} else {
		entryAmount = dec(source.amount);
	}

	if (entryStatus === "MISMATCH") {
		await recordEntry(order, source, entryAmount, {
			status: "MISMATCH",
			note: mismatchMessage,
		});
		return {
			ok: false,
			reason: "AMOUNT_MISMATCH",
			message:
				mismatchMessage ?? "The amount paid does not match the order total.",
		};
	}

	const written = await recordEntry(order, source, entryAmount, {
		status: "SUCCESS",
		note: source.kind === "MANUAL" ? (source.note ?? null) : null,
	});

	// A duplicate webhook loses the insert race to the unique index. The money
	// is already recorded, so report the settled state rather than an error.
	const credited = await sumCredits(order.id);
	const outstanding = expected.minus(credited);
	const fullyPaid = outstanding.lessThanOrEqualTo(0);

	let newlyPaid = false;

	if (fullyPaid && order.paymentStatus !== PaymentStatus.PAID) {
		// Conditional update rather than read-then-write: two providers' retries
		// arriving together would both pass an `if (status !== PAID)` check.
		// Here exactly one of them updates a row, and only that one notifies.
		const claimed = await db.order.updateMany({
			where: { id: order.id, paymentStatus: { not: PaymentStatus.PAID } },
			data: {
				paymentStatus: PaymentStatus.PAID,
				status:
					order.status === OrderStatus.PENDING_PAYMENT
						? OrderStatus.CONFIRMED
						: order.status,
				...(source.kind === "GATEWAY"
					? {
							paymentProvider: source.gateway.toLowerCase(),
							paymentRef: source.reference,
						}
					: {}),
			},
		});
		newlyPaid = claimed.count > 0;
	}

	return {
		ok: true,
		newlyPaid: newlyPaid && written,
		amountPaid: credited.toNumber(),
		outstanding: Math.max(0, outstanding.toNumber()),
	};
}

export type RefundResult =
	| { ok: true; refunded: number; viaGateway: boolean }
	| { ok: false; message: string };

/**
 * Returns money for a payment.
 *
 * Appends a REFUND entry and marks the original REVERSED — the original row is
 * never edited, so the record still shows what was taken as well as what was
 * given back. That is the difference between an audit trail and a current
 * balance, and only one of them is any use when a customer disputes a charge.
 *
 * A provider without refund support is not a dead end: the refund is recorded
 * as offline, which tells the restaurant they owe the customer money by hand
 * rather than silently doing nothing.
 */
export async function refundPayment(params: {
	paymentId: string;
	restaurantId: string;
	/** Naira. Defaults to the whole entry. */
	amount?: number;
	reason?: string;
	recordedById?: string | null;
	/** Skips the provider call and records a refund settled in person. */
	offline?: boolean;
}): Promise<RefundResult> {
	const entry = await db.orderPayment.findFirst({
		where: {
			id: params.paymentId,
			restaurantId: params.restaurantId,
			direction: "CREDIT",
			status: "SUCCESS",
		},
		select: {
			id: true,
			orderId: true,
			amount: true,
			gateway: true,
			method: true,
			reference: true,
			restaurantId: true,
		},
	});

	if (!entry) {
		return { ok: false, message: "That payment can't be refunded." };
	}

	const amount = dec(params.amount ?? entry.amount);

	if (amount.lessThanOrEqualTo(0) || amount.greaterThan(entry.amount)) {
		return {
			ok: false,
			message: `Enter an amount between ₦0.01 and ₦${dec(entry.amount).toFixed(2)}.`,
		};
	}

	let viaGateway = false;

	if (!params.offline && entry.gateway && entry.reference) {
		const { getGatewayAdapter } = await import("@/lib/payment-gateways");
		const { resolveRefundCredentials } = await import(
			"@/actions/payment-settings.actions"
		);
		const credentials = await resolveRefundCredentials(
			entry.restaurantId,
			entry.gateway,
		);

		if (!credentials) {
			return {
				ok: false,
				message:
					"That provider is no longer connected, so the refund can't be sent automatically. Record it as an offline refund instead.",
			};
		}

		const adapter = getGatewayAdapter(entry.gateway);
		if (!adapter.refundCharge) {
			return {
				ok: false,
				message: `${entry.gateway} refunds aren't automated yet. Refund the customer directly, then record it as an offline refund.`,
			};
		}

		const result = await adapter.refundCharge(credentials, {
			reference: entry.reference,
			amountKobo: Math.round(amount.toNumber() * 100),
			reason: params.reason,
		});

		// Nothing is written when the provider refuses — a REFUND row for money
		// that never moved is worse than no row at all.
		if (!result.ok) return { ok: false, message: result.error };
		viaGateway = true;
	}

	await db.orderPayment.create({
		data: {
			orderId: entry.orderId,
			restaurantId: entry.restaurantId,
			amount,
			// Mirrors how the money came in, so a refunded cash sale doesn't read
			// as a card refund on the export a bookkeeper works from.
			method: entry.method,
			direction: "REFUND",
			status: "SUCCESS",
			// Left null so it cannot collide with the original's unique key.
			gateway: null,
			recordedById: params.recordedById ?? null,
			note:
				params.reason ??
				(viaGateway ? "Refunded to card" : "Refunded outside AwaMenu"),
		},
	});

	// Only a full refund reverses the original, and it is a display state, not
	// an arithmetic one — the REFUND row is what moves the balance. Marking a
	// partly-refunded payment REVERSED would claim more was returned than was.
	if (amount.equals(entry.amount)) {
		await db.orderPayment.update({
			where: { id: entry.id },
			data: { status: "REVERSED" },
		});
	}

	// Derived from the ledger rather than assumed: a partial refund leaves the
	// order paid, a full one does not.
	const remaining = await sumCredits(entry.orderId);
	const order = await db.order.findUnique({
		where: { id: entry.orderId },
		select: { total: true },
	});

	if (order && remaining.lessThan(order.total)) {
		await db.order.update({
			where: { id: entry.orderId },
			data: {
				paymentStatus: remaining.lessThanOrEqualTo(0)
					? PaymentStatus.REFUNDED
					: PaymentStatus.PENDING,
			},
		});
	}

	return { ok: true, refunded: amount.toNumber(), viaGateway };
}

/** Everything successfully credited against an order, less anything refunded. */
async function sumCredits(orderId: string): Promise<Prisma.Decimal> {
	// REVERSED is included deliberately: the money genuinely was collected, and
	// the matching REFUND row is what takes it back out. Excluding it here would
	// subtract the same refund twice.
	const entries = await db.orderPayment.findMany({
		where: { orderId, status: { in: ["SUCCESS", "REVERSED"] } },
		select: { amount: true, direction: true },
	});

	return entries.reduce(
		(total, entry) =>
			entry.direction === "REFUND"
				? total.minus(entry.amount)
				: total.plus(entry.amount),
		new Prisma.Decimal(0),
	);
}

/**
 * Appends one ledger row.
 *
 * Returns false when the row already existed — the unique index on
 * (gateway, reference) is what makes a replayed webhook harmless, and hitting
 * it is an expected outcome rather than a failure.
 */
async function recordEntry(
	order: { id: string; restaurantId: string; total: Prisma.Decimal },
	source: CreditSource,
	amount: Prisma.Decimal,
	options: { status: LedgerEntryStatus; note?: string | null },
): Promise<boolean> {
	// Checked before inserting purely to keep the logs honest: relying on the
	// unique index alone means Prisma logs a scary `prisma:error` on every
	// replayed webhook, and an operator learns to ignore payment errors. The
	// constraint is still the actual guarantee — this only avoids provoking it
	// in the common case, and the catch below handles a genuine race.
	if (source.kind === "GATEWAY") {
		const seen = await db.orderPayment.findFirst({
			where: { gateway: source.gateway, reference: source.reference },
			select: { id: true },
		});
		if (seen) return false;
	}

	const split =
		source.kind === "GATEWAY"
			? await resolveSplit(source, amount.toNumber())
			: null;

	try {
		await db.orderPayment.create({
			data: {
				orderId: order.id,
				restaurantId: order.restaurantId,
				amount,
				expectedAmount: order.total,
				status: options.status,
				direction: "CREDIT",
				note: options.note ?? null,
				...(source.kind === "GATEWAY"
					? {
							method: "PAYSTACK" as PaymentMethod,
							gateway: source.gateway,
							reference: source.reference,
							currency: source.currency.toUpperCase(),
							subaccountCode: source.subaccountCode ?? null,
							gatewayFee: split?.gatewayFee ?? null,
							platformFee: split?.platformFee ?? null,
							netToRestaurant: split?.netToRestaurant ?? null,
							rawPayload: (source.rawPayload ?? Prisma.JsonNull) as never,
						}
					: {
							method: source.method,
							reference: source.reference ?? null,
							recordedById: source.recordedById ?? null,
						}),
			},
		});
		return true;
	} catch (error) {
		if (
			error instanceof Prisma.PrismaClientKnownRequestError &&
			error.code === "P2002"
		) {
			return false;
		}
		throw error;
	}
}
