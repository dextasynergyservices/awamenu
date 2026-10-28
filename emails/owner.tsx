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
	Title,
} from "./components";

/**
 * AwaMenu writing to a restaurant owner: accounts, billing and activity at
 * their restaurant. Always AwaMenu-branded (`platformBrand`), whatever the
 * restaurant's plan.
 */

type Base = { brand: EmailBrand };

// ─── Account ──────────────────────────────────────────

export function VerifyEmail(props: Base & { verifyUrl: string; code: string }) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview="Confirm your email to finish setting up AwaMenu."
			footerReason="You're receiving this because this address was used to create an AwaMenu account."
		>
			<Title>Confirm your email</Title>
			<P>
				Welcome to AwaMenu. You&apos;re almost set up: confirm this is your
				email address.
			</P>
			<Cta brand={brand} href={props.verifyUrl}>
				Confirm email address
			</Cta>
			<P>Or enter this code on the verification page:</P>
			<Code brand={brand} code={props.code} />
			<P muted>
				The link and code expire in 24 hours. If you didn&apos;t create an
				AwaMenu account, you can ignore this email.
			</P>
		</EmailLayout>
	);
}

export function PasswordResetEmail(props: Base & { code: string }) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`${props.code} is your AwaMenu password reset code.`}
		>
			<Title>Reset your password</Title>
			<P>Enter this code to choose a new password:</P>
			<Code brand={brand} code={props.code} />
			<P muted>
				It expires in 15 minutes. If you didn&apos;t ask to reset your password,
				you can ignore this email; your password hasn&apos;t changed.
			</P>
		</EmailLayout>
	);
}

export function WelcomeEmail(
	props: Base & { restaurantName: string; dashboardUrl: string },
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`${props.restaurantName} is set up on AwaMenu.`}
		>
			<Title>Welcome to AwaMenu</Title>
			<P>
				{props.restaurantName} is set up. Here&apos;s how to get your first
				orders:
			</P>
			<Details
				rows={[
					["1", "Add your dishes and photos in Menu"],
					["2", "Set your opening hours and ordering options in Settings"],
					["3", "Print your QR codes and put them on the tables"],
				]}
			/>
			<Cta brand={brand} href={props.dashboardUrl}>
				Open your dashboard
			</Cta>
		</EmailLayout>
	);
}

export function PayoutChangedEmail(
	props: Base & {
		restaurantName: string;
		previous: string;
		next: string;
		settingsUrl: string;
	},
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`The payout account for ${props.restaurantName} was changed.`}
		>
			<Title>Your payout account was changed</Title>
			<P>
				The bank account that receives payments for {props.restaurantName} was
				just changed.
			</P>
			<Details
				rows={[
					["Previous", props.previous],
					["New", props.next],
				]}
			/>
			<Callout tone="danger" title="Didn't make this change?">
				Your payouts are now going somewhere else. Sign in, change it back
				immediately, then reply to this email.
			</Callout>
			<Cta brand={brand} href={props.settingsUrl}>
				Check payment settings
			</Cta>
			<P muted>If you made this change, no action is needed.</P>
		</EmailLayout>
	);
}

// ─── Billing ──────────────────────────────────────────

export function SubscriptionConfirmedEmail(
	props: Base & { planName: string; continueUrl: string },
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`Your ${props.planName} plan is active.`}
		>
			<Title>Your {props.planName} plan is active</Title>
			<P>
				Thanks for subscribing. Continue setting up your restaurant from where
				you left off.
			</P>
			<Cta brand={brand} href={props.continueUrl}>
				Continue setup
			</Cta>
		</EmailLayout>
	);
}

export function RenewalReceiptEmail(
	props: Base & {
		restaurantName: string;
		planName: string;
		amount: string;
		periodEnd: string | null;
		receiptUrl: string;
	},
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`Receipt: ${props.amount} for ${props.restaurantName}.`}
		>
			<Title>Payment received</Title>
			<P>
				Thanks. Your {props.planName} plan for {props.restaurantName} has been
				renewed.
			</P>
			<Details
				rows={[
					["Restaurant", props.restaurantName],
					["Plan", props.planName],
					["Amount", props.amount],
					props.periodEnd ? ["Active until", props.periodEnd] : null,
				]}
			/>
			<Cta brand={brand} href={props.receiptUrl}>
				View invoice
			</Cta>
		</EmailLayout>
	);
}

export function AutoRenewalUpcomingEmail(
	props: Base & {
		restaurantName: string;
		daysLeft: number;
		amount: string;
		billingUrl: string;
	},
) {
	const { brand } = props;
	const when =
		props.daysLeft <= 0
			? "today"
			: `in ${props.daysLeft} day${props.daysLeft === 1 ? "" : "s"}`;
	return (
		<EmailLayout
			brand={brand}
			preview={`${props.restaurantName} renews ${when}: ${props.amount}.`}
		>
			<Title>Your plan renews {when}</Title>
			<P>
				The subscription for {props.restaurantName} renews automatically {when}.
				We&apos;ll charge {props.amount} to your saved card. Nothing to do if
				that&apos;s fine.
			</P>
			<Cta brand={brand} href={props.billingUrl}>
				Manage billing
			</Cta>
		</EmailLayout>
	);
}

export function ExpiryUpcomingEmail(
	props: Base & { restaurantName: string; daysLeft: number; renewUrl: string },
) {
	const { brand } = props;
	const days = `${props.daysLeft} day${props.daysLeft === 1 ? "" : "s"}`;
	return (
		<EmailLayout
			brand={brand}
			preview={`${props.restaurantName}'s plan ends in ${days}.`}
		>
			<Title>Your plan ends in {days}</Title>
			<P>
				The subscription for {props.restaurantName} isn&apos;t set to renew.
				Renew now to keep taking orders and bookings without a break.
			</P>
			<Cta brand={brand} href={props.renewUrl}>
				Renew now
			</Cta>
		</EmailLayout>
	);
}

export function GracePeriodEmail(
	props: Base & { restaurantName: string; renewUrl: string },
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`${props.restaurantName}'s plan has ended. 3 days to renew.`}
		>
			<Title>Your plan has ended</Title>
			<P>
				The subscription for {props.restaurantName} has ended. Everything keeps
				working for 3 more days while you renew.
			</P>
			<Callout tone="warning" title="After 3 days">
				Customers can still see your menu but can&apos;t order or book, and your
				dashboard becomes read-only until you renew.
			</Callout>
			<Cta brand={brand} href={props.renewUrl}>
				Renew now
			</Cta>
		</EmailLayout>
	);
}

export function LapsedEmail(
	props: Base & { restaurantName: string; renewUrl: string },
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`${props.restaurantName} has stopped taking orders.`}
		>
			<Title>{props.restaurantName} has stopped taking orders</Title>
			<P>
				The 3-day grace period passed without a renewal, so your restaurant is
				now read-only.
			</P>
			<Details
				rows={[
					["Customers", "See your menu, but can't order or book"],
					["You", "Can sign in and see orders and reports"],
					["Changes", "Paused until you renew"],
					["Your data", "Kept; nothing has been deleted"],
				]}
			/>
			<P>
				Pay to reactivate. Your new period starts the day you pay, and
				everything comes back immediately.
			</P>
			<Cta brand={brand} href={props.renewUrl}>
				Pay and reactivate
			</Cta>
			<P muted>
				Think this is a mistake? Reply to this email and we&apos;ll help.
			</P>
		</EmailLayout>
	);
}

export function ReactivatedEmail(
	props: Base & { restaurantName: string; dashboardUrl: string },
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`${props.restaurantName} is taking orders again.`}
		>
			<Title>{props.restaurantName} is back</Title>
			<P>
				Thanks for renewing. Customers can order and book again, and you and
				your staff can use the dashboard as normal.
			</P>
			<Cta brand={brand} href={props.dashboardUrl}>
				Go to dashboard
			</Cta>
		</EmailLayout>
	);
}

// ─── Restaurant activity ──────────────────────────────

const activityReason = (restaurantName: string) =>
	`You're receiving this because you own ${restaurantName} on AwaMenu.`;

export function NewOrderEmail(
	props: Base & {
		restaurantName: string;
		reference: string;
		orderType: string;
		customerName: string;
		items: EmailLine[];
		total: string;
		dashboardUrl: string;
	},
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`${props.customerName} · ${props.orderType} · ${props.total}`}
			footerReason={activityReason(props.restaurantName)}
		>
			<Title>New order #{props.reference}</Title>
			<P>
				{props.customerName} placed a {props.orderType.toLowerCase()} order at{" "}
				{props.restaurantName}. Accept it to let them know you&apos;re on it.
			</P>
			<Items items={props.items} total={props.total} />
			<Cta brand={brand} href={props.dashboardUrl}>
				Accept or decline
			</Cta>
			<P muted>
				The customer isn&apos;t told the order is confirmed until you accept it.
			</P>
		</EmailLayout>
	);
}

export function OwnerPaymentReceivedEmail(
	props: Base & {
		restaurantName: string;
		reference: string;
		orderType: string;
		customerName: string;
		total: string;
		paymentMethod: string;
		dashboardUrl: string;
	},
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`${props.customerName} paid ${props.total} for order #${props.reference}.`}
			footerReason={activityReason(props.restaurantName)}
		>
			<Title>{props.total} received</Title>
			<P>
				{props.customerName} paid for order #{props.reference} at{" "}
				{props.restaurantName}.
			</P>
			<Details
				rows={[
					["Order", `#${props.reference}`],
					["Type", props.orderType],
					["Method", props.paymentMethod],
					["Amount", props.total],
				]}
			/>
			<Cta brand={brand} href={props.dashboardUrl}>
				Open order
			</Cta>
			<P muted>
				When the money reaches your bank depends on your payment provider.
			</P>
		</EmailLayout>
	);
}

export function OwnerBookingRequestEmail(
	props: Base & {
		restaurantName: string;
		customerName: string;
		when: string;
		table: string;
		partySize: number;
		note: string | null;
		dashboardUrl: string;
	},
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`${props.customerName} wants ${props.table} on ${props.when}.`}
			footerReason={activityReason(props.restaurantName)}
		>
			<Title>New booking request</Title>
			<P>
				{props.customerName} asked for a table at {props.restaurantName}. It
				needs your approval.
			</P>
			<Details
				rows={[
					["When", props.when],
					["Table", props.table],
					["Guests", String(props.partySize)],
					props.note ? ["Note", props.note] : null,
				]}
			/>
			<Cta brand={brand} href={props.dashboardUrl}>
				Approve or decline
			</Cta>
			<P muted>
				If no one answers in time, the request is released and the guest is
				told.
			</P>
		</EmailLayout>
	);
}

export function OwnerGuestCancelledEmail(
	props: Base & {
		restaurantName: string;
		customerName: string;
		when: string;
		table: string;
		refund: string | null;
		dashboardUrl: string;
	},
) {
	const { brand } = props;
	return (
		<EmailLayout
			brand={brand}
			preview={`${props.customerName} cancelled ${props.table} for ${props.when}.`}
			footerReason={activityReason(props.restaurantName)}
		>
			<Title>A guest cancelled their booking</Title>
			<P>
				{props.customerName} cancelled {props.table} for {props.when}. The table
				is free again.
			</P>
			{props.refund ? (
				<Callout tone="warning" title={`Refund to handle: ${props.refund}`}>
					They paid for this booking. Refund them under your cancellation
					policy, then mark it refunded in Reservations.
				</Callout>
			) : null}
			<Cta brand={brand} href={props.dashboardUrl}>
				View booking
			</Cta>
		</EmailLayout>
	);
}
