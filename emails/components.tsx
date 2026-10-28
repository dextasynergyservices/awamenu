import {
	Body,
	Button,
	Column,
	Container,
	Head,
	Heading,
	Html,
	Img,
	Link,
	Preview,
	Row,
	Section,
	Text,
} from "@react-email/components";
import type { ReactNode } from "react";
import type { EmailBrand } from "./brand";

/**
 * The one design every AwaMenu email shares.
 *
 * Inline styles and tables only (React Email renders these): Gmail strips
 * <style> blocks and Outlook has no flexbox, so anything cleverer falls apart
 * in the clients most people use. Status colours (success, warning, danger)
 * are fixed; only the brand's own accent changes per restaurant.
 */

const FONT =
	"-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const INK = "#0f172a";
const BODY = "#334155";
const MUTED = "#64748b";
const LINE = "#e2e8f0";

function Monogram({ brand, size }: { brand: EmailBrand; size: number }) {
	return (
		<table cellPadding={0} cellSpacing={0} role="presentation">
			<tbody>
				<tr>
					<td
						width={size}
						height={size}
						align="center"
						style={{
							width: size,
							height: size,
							borderRadius: 10,
							backgroundColor: brand.accent,
							color: brand.onAccent,
							fontSize: Math.round(size * 0.45),
							fontWeight: 800,
							fontFamily: FONT,
						}}
					>
						{brand.name.trim().charAt(0).toUpperCase() || "•"}
					</td>
				</tr>
			</tbody>
		</table>
	);
}

function Header({ brand }: { brand: EmailBrand }) {
	return (
		<Section style={{ padding: "0 4px 16px" }} data-skip-in-text="true">
			<Row>
				<Column style={{ width: 48, verticalAlign: "middle" }}>
					<Link href={brand.homeUrl}>
						{brand.logoUrl ? (
							<Img
								src={brand.logoUrl}
								width={40}
								height={40}
								alt={brand.name}
								style={{
									borderRadius: 10,
									objectFit: "cover",
									display: "block",
								}}
							/>
						) : (
							<Monogram brand={brand} size={40} />
						)}
					</Link>
				</Column>
				<Column style={{ verticalAlign: "middle" }}>
					<Link
						href={brand.homeUrl}
						style={{
							color: INK,
							fontSize: 17,
							fontWeight: 800,
							textDecoration: "none",
						}}
					>
						{brand.name}
					</Link>
				</Column>
			</Row>
		</Section>
	);
}

function Footer({ brand, reason }: { brand: EmailBrand; reason?: string }) {
	const small = {
		margin: "0 0 6px",
		color: MUTED,
		fontSize: 12,
		lineHeight: "18px",
	};
	if (brand.kind === "platform") {
		return (
			<Section style={{ padding: "20px 8px 0", textAlign: "center" }}>
				<Text style={small}>
					{reason ??
						"You're receiving this because you have an AwaMenu account."}
				</Text>
				<Text style={small}>
					<Link
						href={brand.homeUrl}
						style={{ color: MUTED, textDecoration: "underline" }}
					>
						AwaMenu
					</Link>{" "}
					· Digital menus, orders and table bookings for restaurants
				</Text>
			</Section>
		);
	}
	const contact = [brand.address, brand.phone].filter(Boolean).join(" · ");
	return (
		<Section style={{ padding: "20px 8px 0", textAlign: "center" }}>
			<Text style={{ ...small, color: INK, fontWeight: 700 }}>
				{brand.name}
			</Text>
			{contact ? <Text style={small}>{contact}</Text> : null}
			<Text style={small}>
				{reason ??
					`You're receiving this because you ordered from or booked with ${brand.name}.`}
			</Text>
			{brand.poweredBy ? (
				<Text style={{ ...small, marginTop: 12 }}>
					Powered by{" "}
					<Link
						href="https://awamenu.com"
						style={{ color: MUTED, fontWeight: 700 }}
					>
						AwaMenu
					</Link>
				</Text>
			) : null}
		</Section>
	);
}

export function EmailLayout({
	brand,
	preview,
	footerReason,
	children,
}: {
	brand: EmailBrand;
	/** The grey line inbox lists show next to the subject. */
	preview: string;
	footerReason?: string;
	children: ReactNode;
}) {
	return (
		<Html lang="en">
			<Head>
				<meta name="color-scheme" content="light" />
				<meta name="supported-color-schemes" content="light" />
			</Head>
			<Preview>{preview}</Preview>
			<Body style={{ margin: 0, backgroundColor: "#f1f5f9", fontFamily: FONT }}>
				<Container
					style={{ maxWidth: 560, margin: "0 auto", padding: "28px 12px 36px" }}
				>
					<Header brand={brand} />
					<Section
						style={{
							backgroundColor: "#ffffff",
							border: `1px solid ${LINE}`,
							borderTop: `4px solid ${brand.accent}`,
							borderRadius: 16,
							padding: "28px 28px 24px",
						}}
					>
						{children}
					</Section>
					<Footer brand={brand} reason={footerReason} />
				</Container>
			</Body>
		</Html>
	);
}

export function Title({ children }: { children: ReactNode }) {
	return (
		<Heading
			as="h1"
			style={{
				margin: "0 0 10px",
				color: INK,
				fontSize: 22,
				lineHeight: "30px",
				fontWeight: 800,
			}}
		>
			{children}
		</Heading>
	);
}

export function P({
	children,
	muted,
}: {
	children: ReactNode;
	muted?: boolean;
}) {
	return (
		<Text
			style={{
				margin: "0 0 14px",
				color: muted ? MUTED : BODY,
				fontSize: muted ? 13 : 15,
				lineHeight: muted ? "20px" : "24px",
			}}
		>
			{children}
		</Text>
	);
}

/** Label/value pairs: the facts of an order or booking. */
export function Details({
	rows,
}: {
	rows: Array<[string, ReactNode] | null | false>;
}) {
	const visible = rows.filter(Boolean) as Array<[string, ReactNode]>;
	if (visible.length === 0) return null;
	return (
		<Section
			style={{
				margin: "18px 0",
				backgroundColor: "#f8fafc",
				border: `1px solid ${LINE}`,
				borderRadius: 12,
			}}
		>
			<table
				width="100%"
				cellPadding={0}
				cellSpacing={0}
				role="presentation"
				className="email-table"
				style={{ padding: "6px 16px" }}
			>
				<tbody>
					{visible.map(([label, value], i) => (
						<tr key={label}>
							<td
								style={{
									padding: "9px 0",
									borderTop: i === 0 ? "none" : `1px solid ${LINE}`,
									color: MUTED,
									fontSize: 13,
									verticalAlign: "top",
									width: "38%",
								}}
							>
								{label}
							</td>
							<td
								style={{
									padding: "9px 0",
									borderTop: i === 0 ? "none" : `1px solid ${LINE}`,
									color: INK,
									fontSize: 14,
									fontWeight: 600,
									textAlign: "right",
									verticalAlign: "top",
								}}
							>
								{value}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</Section>
	);
}

export type EmailLine = { name: string; quantity: number; amount: string };

/** An itemised list with an optional total, like a receipt. */
export function Items({
	items,
	total,
	extra,
}: {
	items: EmailLine[];
	total?: string;
	/** Rows above the total, e.g. a delivery fee. */
	extra?: Array<[string, string]>;
}) {
	if (items.length === 0) return null;
	const cell = {
		padding: "8px 0",
		fontSize: 14,
		color: INK,
		verticalAlign: "top" as const,
	};
	return (
		<table
			width="100%"
			cellPadding={0}
			cellSpacing={0}
			role="presentation"
			className="email-table"
			style={{ margin: "4px 0 18px" }}
		>
			<tbody>
				{items.map((item, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: rendered once to static HTML; the same dish can appear twice with different options.
					<tr key={`${item.name}-${i}`}>
						<td style={{ ...cell, color: MUTED, width: 36 }}>
							{item.quantity}×
						</td>
						<td style={cell}>{item.name}</td>
						<td style={{ ...cell, textAlign: "right", whiteSpace: "nowrap" }}>
							{item.amount}
						</td>
					</tr>
				))}
				{(extra ?? []).map(([label, value]) => (
					<tr key={label}>
						<td />
						<td style={{ ...cell, color: MUTED }}>{label}</td>
						<td style={{ ...cell, color: MUTED, textAlign: "right" }}>
							{value}
						</td>
					</tr>
				))}
				{total ? (
					<tr>
						<td style={{ borderTop: `1px solid ${LINE}` }} />
						<td
							style={{
								...cell,
								borderTop: `1px solid ${LINE}`,
								paddingTop: 12,
								fontWeight: 800,
							}}
						>
							Total
						</td>
						<td
							style={{
								...cell,
								borderTop: `1px solid ${LINE}`,
								paddingTop: 12,
								fontWeight: 800,
								fontSize: 16,
								textAlign: "right",
								whiteSpace: "nowrap",
							}}
						>
							{total}
						</td>
					</tr>
				) : null}
			</tbody>
		</table>
	);
}

export function Cta({
	brand,
	href,
	children,
}: {
	brand: EmailBrand;
	href: string;
	children: ReactNode;
}) {
	return (
		<Section style={{ margin: "22px 0 6px" }}>
			<Button
				href={href}
				style={{
					backgroundColor: brand.accent,
					color: brand.onAccent,
					fontSize: 15,
					fontWeight: 700,
					padding: "13px 22px",
					borderRadius: 12,
					textDecoration: "none",
				}}
			>
				{children}
			</Button>
		</Section>
	);
}

const TONES = {
	info: { bg: "#f1f5f9", border: "#cbd5e1", ink: "#1e293b" },
	success: { bg: "#ecfdf5", border: "#a7f3d0", ink: "#065f46" },
	warning: { bg: "#fffbeb", border: "#fde68a", ink: "#92400e" },
	danger: { bg: "#fef2f2", border: "#fecaca", ink: "#991b1b" },
} as const;

/** A highlighted box for the one thing the reader mustn't miss. */
export function Callout({
	tone,
	title,
	children,
}: {
	tone: keyof typeof TONES;
	title?: string;
	children?: ReactNode;
}) {
	const t = TONES[tone];
	return (
		<Section
			style={{
				margin: "16px 0",
				padding: "14px 16px",
				backgroundColor: t.bg,
				border: `1px solid ${t.border}`,
				borderRadius: 12,
			}}
		>
			{title ? (
				<Text
					style={{
						margin: children ? "0 0 4px" : 0,
						color: t.ink,
						fontSize: 14,
						fontWeight: 800,
					}}
				>
					{title}
				</Text>
			) : null}
			{children ? (
				<Text
					style={{ margin: 0, color: t.ink, fontSize: 14, lineHeight: "21px" }}
				>
					{children}
				</Text>
			) : null}
		</Section>
	);
}

/** A one-time code, large and easy to copy. */
export function Code({ brand, code }: { brand: EmailBrand; code: string }) {
	return (
		<Section
			style={{
				margin: "18px 0",
				padding: "18px",
				backgroundColor: "#f8fafc",
				border: `1px solid ${LINE}`,
				borderRadius: 12,
				textAlign: "center",
			}}
		>
			<Text
				style={{
					margin: 0,
					color: brand.accentText,
					fontSize: 32,
					fontWeight: 800,
					letterSpacing: 8,
					fontFamily: "'SFMono-Regular', Menlo, Consolas, monospace",
				}}
			>
				{code}
			</Text>
		</Section>
	);
}

export function TextLink({
	brand,
	href,
	children,
}: {
	brand: EmailBrand;
	href: string;
	children: ReactNode;
}) {
	return (
		<Link
			href={href}
			style={{
				color: brand.accentText,
				fontWeight: 700,
				textDecoration: "underline",
			}}
		>
			{children}
		</Link>
	);
}
