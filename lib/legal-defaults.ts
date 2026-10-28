/**
 * The built-in text of the legal pages, used until the super admin saves an
 * edited version (LegalDocument row) and again after "Restore default text".
 *
 * Written in the limited Markdown that lib/legal-markdown.tsx renders, with
 * {{placeholders}} for the company details set in Super Admin → Legal.
 */

export type LegalKind = "PRIVACY" | "TERMS" | "REFUNDS";

export const LEGAL_KINDS: LegalKind[] = ["PRIVACY", "TERMS", "REFUNDS"];

/** Fixed per page: the URL and title are what other pages and emails link to. */
export const LEGAL_PAGE_META: Record<
	LegalKind,
	{ title: string; path: string; description: string }
> = {
	PRIVACY: {
		title: "Privacy Policy",
		path: "/privacy",
		description: "How AwaMenu collects, uses and protects personal data.",
	},
	TERMS: {
		title: "Terms of Service",
		path: "/terms",
		description: "The terms for using AwaMenu as a restaurant or a customer.",
	},
	REFUNDS: {
		title: "Refund Policy",
		path: "/refunds",
		description: "How refunds work for orders, reservations and subscriptions.",
	},
};

/** URL segment ↔ kind, for the super-admin editor routes. */
export function legalKindFromParam(param: string): LegalKind | null {
	const kind = param.toUpperCase();
	return (LEGAL_KINDS as string[]).includes(kind) ? (kind as LegalKind) : null;
}

/** When the built-in text took effect. */
export const DEFAULT_EFFECTIVE_DATE = "2026-10-26";

export const LEGAL_DEFAULTS: Record<
	LegalKind,
	{ intro: string; body: string }
> = {
	PRIVACY: {
		intro:
			"This policy explains what personal data AwaMenu collects, why, who it is shared with, and your rights under the Nigeria Data Protection Act 2023 (NDPA). AwaMenu is operated by {{companyName}} (RC {{rcNumber}}), {{registeredAddress}}.",
		body: `## 1. Who is responsible for your data

- **If you order from or book a restaurant** through AwaMenu, that restaurant decides how your order details are used. It is the data controller, and AwaMenu processes the data on its behalf to run the ordering, payment and booking service.
- **If you run a restaurant on AwaMenu**, AwaMenu is the data controller for your account and billing information.

## 2. What we collect

### Customers

- Name, phone number and, if you give it, email address.
- Delivery address, for delivery orders.
- What you order or book: items, notes, table, party size, times and amounts.
- Ratings and comments you choose to leave.
- If you sign in to see your orders: the phone number or email you verify, and a sign-in session cookie.

### Restaurant owners and staff

- Owner name, email and password (stored only as a one-way hash).
- Restaurant details, menu, opening hours and branding.
- Bank account details for payouts, verified with the payment provider.
- Staff names and staff IDs, and a record of actions taken (for example, who recorded a payment).

### Everyone

- Technical data needed to keep the service secure and working: IP address, browser and device type, and error reports.
- Usage analytics about how the app is used, to improve it.

**We never see or store your card details.** Card payments are entered on, and processed by, the payment provider (Paystack, Monnify or Flutterwave).

## 3. Why we use it, and on what basis

- **To provide the service you asked for**: placing and tracking orders, taking payments, making reservations, sending order and booking updates, running restaurant accounts (performance of a contract).
- **To keep the service secure**: preventing fraud and abuse, rate limiting, investigating errors (legitimate interests).
- **To meet legal obligations**: keeping financial and tax records (legal obligation).
- **To improve the service**: aggregated usage analytics (legitimate interests).

We do not sell personal data, and we do not send marketing messages to customers.

## 4. Who we share it with

- **The restaurant** you order from or book with.
- **Payment providers** (Paystack, Monnify, Flutterwave) to take and settle payments.
- **Messaging providers**: Twilio (WhatsApp and SMS) and Resend (email), to send order updates and sign-in codes.
- **Infrastructure providers** that host and run the service: Vercel (hosting), Neon (database), Upstash (rate limiting), Cloudinary (images), Cloudflare (security), Sentry (error reports), PostHog (analytics).
- **Authorities**, where the law requires it.

Some of these providers store data outside Nigeria (our database and hosting are in the European Union). Where data leaves Nigeria we rely on the safeguards the NDPA allows, including contractual protections with each provider.

## 5. How long we keep it

- Sign-in codes: 10 minutes.
- Queued messages (email, WhatsApp, SMS): deleted 14 days after sending.
- Orders, payments and refunds: as long as needed for accounting and tax purposes, typically six years.
- Restaurant accounts: while the account is active, then as required for the records above.

## 6. Your rights

Under the NDPA you can ask us to:

- tell you what personal data we hold about you, and give you a copy;
- correct data that is wrong;
- delete your data, where we are not required to keep it (for example for financial records);
- restrict or object to how we use it;
- move your data to another service.

Signed-in customers can update their profile from the account menu on any restaurant page. For anything else, email [{{privacyEmail}}](mailto:{{privacyEmail}}). We reply within 30 days. If you are not satisfied, you can complain to the Nigeria Data Protection Commission (NDPC).

For order data held on a restaurant's behalf, we may pass your request to that restaurant, as the controller.

## 7. Cookies

We use cookies that keep you signed in (owner, staff and customer sessions) and keep the service secure. These are necessary for the service to work. We also use analytics to understand how the app is used.

## 8. Security

Data is encrypted in transit. Passwords are hashed, sign-in codes and staff PINs are stored only as hashes, and payment gateway keys are encrypted at rest. Access is limited to people who need it.

## 9. Children

AwaMenu is not intended for children under 18 to create accounts.

## 10. Changes and contact

If we change this policy we will update the date above, and tell restaurant owners of significant changes. Questions: [{{privacyEmail}}](mailto:{{privacyEmail}}).`,
	},

	TERMS: {
		intro:
			"These terms apply to everyone who uses AwaMenu, a service operated by {{companyName}} (RC {{rcNumber}}). By using AwaMenu you agree to them.",
		body: `## 1. What AwaMenu is

AwaMenu gives restaurants an online menu, ordering, payments and table reservations. When you order from or book a restaurant on AwaMenu, your agreement for the food and service is with **that restaurant**. AwaMenu provides the technology and is not the seller of the food.

## 2. Customers

- Prices, menus, availability, preparation, delivery and service are the restaurant's responsibility.
- Online payments are processed by the restaurant's payment provider and settle directly to the restaurant (or to its own payment account). AwaMenu does not hold customers' money.
- Reservations follow the restaurant's booking rules, shown before you book. A booking that needs payment is held for a limited time and released if not paid in time.
- Refunds are handled as described in our [Refund Policy](/refunds).
- Give accurate contact details so the restaurant can reach you about your order.

## 3. Restaurants

### Your account

- You must give accurate business information and keep your login, your staff dashboard password and your staff's PINs secure. You are responsible for actions taken from your account and by your staff.
- You are responsible for your menu, prices, food safety, fulfilling orders, honouring reservations, and complying with the laws that apply to your business, including consumer and data protection law for your customers' data.

### Plans and billing

- Paid plans are billed in advance for the chosen period (monthly, quarterly or yearly) and renew automatically if auto-renew is on. You can cancel at any time; your plan stays active until the end of the paid period.
- If a renewal fails, your plan enters a 3-day grace period. If it is still unpaid after that, your restaurant is suspended until payment, and limits of the Free plan may apply.
- Plan features and prices may change. We will give notice before a price change affects your next renewal.

### Payments from your customers

- With **AwaMenu Pay**, payments settle directly to your bank account through the payment provider. The provider's fee, and any AwaMenu commission shown in your settings, are deducted from each payment.
- With **your own payment gateway**, payments go to your account under your agreement with that provider.
- You are responsible for refunds to your customers, including reservation deposits, under your own cancellation policy.

## 4. Acceptable use

You must not use AwaMenu to:

- sell anything illegal, or mislead customers;
- interfere with the service, attempt to access other accounts, or probe it for weaknesses without permission;
- send spam or abuse messaging features.

We may suspend or close accounts that break these terms.

## 5. Availability

We work to keep AwaMenu available and secure, but it is provided "as is". It may occasionally be unavailable for maintenance or reasons outside our control.

## 6. Liability

To the extent the law allows, AwaMenu is not liable for indirect or consequential losses, or for the food, service or conduct of restaurants. Our total liability to a restaurant in any 12 months is limited to the subscription fees it paid in that period. Nothing in these terms limits liability that cannot be limited by law.

## 7. Changes, law and contact

We may update these terms and will change the date above when we do; continuing to use AwaMenu means you accept the updated terms. These terms are governed by the laws of the Federal Republic of Nigeria. Questions: [{{contactEmail}}](mailto:{{contactEmail}}).`,
	},

	REFUNDS: {
		intro:
			"How refunds work on AwaMenu, for customers ordering from restaurants and for restaurants paying for a plan.",
		body: `## 1. Orders and reservations

Payments for food and table bookings go to the restaurant, so **the restaurant decides and issues refunds** under its own policy. Contact the restaurant first. Their phone number is on their menu page and your order or booking page.

- **Cancelled by the restaurant:** if the restaurant cancels your order or declines your booking after you have paid, you are entitled to a refund of what you paid.
- **Cancelled by you:** you can cancel a booking from your booking page until it starts. Whether a deposit is returned depends on the restaurant's cancellation policy, which is shown before you book and before you cancel.
- **Paid twice, or paid after the time ran out:** if a payment arrives that can't be used (for example, you paid twice or your table had already been released), the restaurant is notified that a refund is due.

## 2. How refunds are paid

Refunds go back to the original payment method through the payment provider. Once issued, they usually reach you within 5–10 working days, depending on your bank. Cash payments are refunded in person by the restaurant.

## 3. Restaurant subscriptions

- Subscription fees are paid in advance and are **not refundable** for partial periods. Cancelling stops the next renewal; your plan stays active until the end of the period you paid for.
- If you were charged in error (a duplicate charge, or a charge after you cancelled), contact us within 30 days and we will refund it.

## 4. Contact

If a restaurant does not respond about a refund, or for questions about a subscription charge, email [{{contactEmail}}](mailto:{{contactEmail}}) with your order or booking code and we will help.`,
	},
};
