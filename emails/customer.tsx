import type { EmailBrand } from "./brand";
import {
	Callout,
	Code,
	Cta,
	Details,
	EmailLayout,
	type EmailLine,
	Items,
	P,
	TextLink,
	Title,
} from "./components";

/**
 * Emails a guest receives about one restaurant. Every one wears that
 * restaurant's brand (lib/email-brand.ts); AwaMenu appears only as the
 * "Powered by" line on plans that keep it.
 */

// ─── Orders ───────────────────────────────────────────

type OrderBase = {
	brand: EmailBrand;
	customerName: string;
	reference: string;
	orderUrl: string;
};

export function OrderConfirmedEmail(
	props: OrderBase & { orderType: string; items: EmailLine[]; total: string },
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`${brand.name} accepted your order #${props.reference}.`}
		>
			<Title>Your order is confirmed</Title>
			<P>
				Hi {props.customerName}, {brand.name} has accepted your order and is
				getting it ready.
			</P>
			<Details
				rows={[
					["Order", `#${props.reference}`],
					["Type", props.orderType],
				]}
			/>
			<Items items={props.items} total={props.total} />
			<Cta brand={brand} href={props.orderUrl}>
				Track your order
			</Cta>
			<P muted>
				Questions about your order? Just reply to this email to reach{" "}
				{brand.name}.
			</P>
		</EmailLayout>
	);
}

export function OrderReceiptEmail(
	props: OrderBase & {
		orderType: string;
		items: EmailLine[];
		total: string;
		paymentMethod: string;
		fulfilmentDetail?: string;
	},
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`Receipt for order #${props.reference}: ${props.total} paid.`}
		>
			<Title>Payment received</Title>
			<P>
				Thanks, {props.customerName}. {brand.name} has received your payment.
				Keep this email as your receipt.
			</P>
			<Details
				rows={[
					["Receipt", `#${props.reference}`],
					["Type", props.orderType],
					["Paid with", props.paymentMethod],
					props.fulfilmentDetail ? ["Details", props.fulfilmentDetail] : null,
				]}
			/>
			<Items items={props.items} total={props.total} />
			<Cta brand={brand} href={props.orderUrl}>
				View your order
			</Cta>
			<P muted>This receipt covers order #{props.reference} only.</P>
		</EmailLayout>
	);
}

export function OrderCompletedEmail(
	props: OrderBase & { summary: string; total: string },
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`${props.summary} Tell ${brand.name} how it went.`}
		>
			<Title>Thanks for choosing {brand.name}</Title>
			<P>
				{props.summary} We hope you enjoyed it, {props.customerName}.
			</P>
			<Details
				rows={[
					["Order", `#${props.reference}`],
					["Total", props.total],
				]}
			/>
			<P>How was it? A quick rating helps {brand.name} keep getting better.</P>
			<Cta brand={brand} href={props.orderUrl}>
				Rate your order
			</Cta>
		</EmailLayout>
	);
}

export function OrderCancelledEmail(
	props: OrderBase & { reason: string | null; paid: boolean },
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`Order #${props.reference} couldn't be completed.`}
		>
			<Title>Your order was cancelled</Title>
			<P>
				Sorry, {props.customerName}. {brand.name} can&apos;t complete order #
				{props.reference}.
			</P>
			{props.reason ? (
				<Callout tone="danger" title="Reason">
					{props.reason}
				</Callout>
			) : null}
			{props.paid ? (
				<Callout tone="warning" title="About your payment">
					{brand.name} will refund what you paid to your original payment
					method. Refunds usually arrive within 5–10 working days. Reply to this
					email if you have questions.
				</Callout>
			) : (
				<P>You haven&apos;t been charged.</P>
			)}
			<Cta brand={brand} href={props.orderUrl}>
				View order
			</Cta>
		</EmailLayout>
	);
}

// ─── Table bookings ───────────────────────────────────

export type BookingFacts = {
	reference: string;
	when: string;
	table: string;
	partySize: number;
	note: string | null;
	/** e.g. ["Paid", "₦10,000"] or ["Amount due", "₦10,000"]. */
	amount: [string, string] | null;
};

function BookingDetails({
	brand,
	booking,
}: {
	brand: EmailBrand;
	booking: BookingFacts;
}) {
	return (
		<Details
			rows={[
				["When", booking.when],
				["Table", booking.table],
				[
					"Guests",
					`${booking.partySize} ${booking.partySize === 1 ? "guest" : "guests"}`,
				],
				["Booking", `#${booking.reference}`],
				brand.address
					? [
							"Address",
							<TextLink
								key="a"
								brand={brand}
								href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${brand.name}, ${brand.address}`)}`}
							>
								{brand.address}
							</TextLink>,
						]
					: null,
				brand.phone ? ["Phone", brand.phone] : null,
				booking.note ? ["Your note", booking.note] : null,
				booking.amount,
			]}
		/>
	);
}

type BookingBase = {
	brand: EmailBrand;
	customerName: string;
	booking: BookingFacts;
	viewUrl: string;
};

export function ReservationRequestedEmail(props: BookingBase) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`${brand.name} will confirm your table for ${props.booking.when}.`}
		>
			<Title>We&apos;ve got your request</Title>
			<P>
				Thanks, {props.customerName}. {brand.name} will review your request and
				confirm shortly.
			</P>
			<Callout tone="info" title="Not confirmed yet">
				We&apos;ll email you as soon as {brand.name} confirms your table.
			</Callout>
			<BookingDetails brand={brand} booking={props.booking} />
			<Cta brand={brand} href={props.viewUrl}>
				Check your booking
			</Cta>
		</EmailLayout>
	);
}

export function ReservationAwaitingPaymentEmail(
	props: BookingBase & { payBy: string | null },
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview="Approved. Pay now to secure your table."
		>
			<Title>Approved: pay to secure your table</Title>
			<P>
				Good news, {props.customerName}. {brand.name} approved your request and
				is holding the table for you.
			</P>
			<Callout
				tone="warning"
				title={props.payBy ? `Pay by ${props.payBy}` : "Payment needed"}
			>
				Your table is confirmed once payment is received. If it isn&apos;t paid
				in time, the table goes back to other guests.
			</Callout>
			<BookingDetails brand={brand} booking={props.booking} />
			<Cta brand={brand} href={props.viewUrl}>
				Pay and confirm
			</Cta>
		</EmailLayout>
	);
}

export function ReservationConfirmedEmail(props: BookingBase) {
	const { brand } = props;
	return (
		<EmailLayout brand={brand} preview={`See you ${props.booking.when}.`}>
			<Title>Your table is confirmed</Title>
			<P>
				You&apos;re all set, {props.customerName}. Show this email or your
				booking page when you arrive.
			</P>
			<BookingDetails brand={brand} booking={props.booking} />
			<Cta brand={brand} href={props.viewUrl}>
				View booking
			</Cta>
			<P muted>
				Plans changed? Cancel from your booking page so the table can go to
				someone else.
			</P>
		</EmailLayout>
	);
}

export function ReservationDeclinedEmail(props: {
	brand: EmailBrand;
	customerName: string;
	when: string;
	reason: string | null;
	paid: boolean;
	bookUrl: string;
}) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`${brand.name} can't take your booking for ${props.when}.`}
		>
			<Title>We can&apos;t take this booking</Title>
			<P>
				Sorry, {props.customerName}. {brand.name} isn&apos;t able to confirm
				your table for {props.when}.
			</P>
			{props.reason ? (
				<Callout tone="danger" title="Reason">
					{props.reason}
				</Callout>
			) : null}
			<P>
				{props.paid
					? `Anything you paid will be refunded by ${brand.name} to your original payment method.`
					: "You haven't been charged."}
			</P>
			<Cta brand={brand} href={props.bookUrl}>
				Choose another time
			</Cta>
		</EmailLayout>
	);
}

export function ReservationCancelledEmail(
	props: BookingBase & {
		by: "guest" | "restaurant";
		reason: string | null;
		/** Amount the restaurant owes back, if any. */
		refund: string | null;
	},
) {
	const { brand } = props;
	const byGuest = props.by === "guest";
	return (
		<EmailLayout
			brand={brand}
			preview={`Your table for ${props.booking.when} has been cancelled.`}
		>
			<Title>
				{byGuest
					? "Your booking is cancelled"
					: `${brand.name} cancelled your booking`}
			</Title>
			<P>
				{byGuest
					? `Hi ${props.customerName}, as requested, your table for ${props.booking.when} has been cancelled.`
					: `Sorry, ${props.customerName}. ${brand.name} has had to cancel your table for ${props.booking.when}.`}
			</P>
			{!byGuest && props.reason ? (
				<Callout tone="danger" title="Reason">
					{props.reason}
				</Callout>
			) : null}
			{props.refund ? (
				<Callout tone="success" title={`Refund: ${props.refund}`}>
					{byGuest
						? `${brand.name} will refund you under their cancellation policy, to your original payment method.`
						: `You'll get everything you paid back. ${brand.name} refunds it to your original payment method; it usually arrives within 5–10 working days.`}
				</Callout>
			) : null}
			<BookingDetails brand={brand} booking={props.booking} />
			<Cta brand={brand} href={props.viewUrl}>
				View booking
			</Cta>
			{brand.phone ? (
				<P muted>Questions? Call {brand.phone} or reply to this email.</P>
			) : null}
		</EmailLayout>
	);
}

export function ReservationReleasedEmail(props: {
	brand: EmailBrand;
	customerName: string;
	when: string;
	reason: "PAYMENT_WINDOW_ENDED" | "REQUEST_NOT_ANSWERED";
	bookUrl: string;
}) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`Your table for ${props.when} is no longer held.`}
		>
			<Title>Your table is no longer held</Title>
			<P>
				Hi {props.customerName},{" "}
				{props.reason === "PAYMENT_WINDOW_ENDED"
					? `we didn't receive payment in time for your table on ${props.when}, so it has been released.`
					: `${brand.name} wasn't able to confirm your request for ${props.when} in time.`}
			</P>
			<P>You haven&apos;t been charged.</P>
			<Cta brand={brand} href={props.bookUrl}>
				Book again
			</Cta>
			{brand.phone ? <P muted>Or call {brand.phone}.</P> : null}
		</EmailLayout>
	);
}

// ─── Sign-in ──────────────────────────────────────────

export function CustomerCodeEmail(props: { brand: EmailBrand; code: string }) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`${props.code} is your ${brand.name} code.`}
			footerReason={`You're receiving this because someone asked to sign in to ${brand.name} with this email.`}
		>
			<Title>Your sign-in code</Title>
			<P>Enter this code to continue with {brand.name}:</P>
			<Code brand={brand} code={props.code} />
			<P muted>
				It expires in 10 minutes. If you didn&apos;t ask for it, you can ignore
				this email.
			</P>
		</EmailLayout>
	);
}
