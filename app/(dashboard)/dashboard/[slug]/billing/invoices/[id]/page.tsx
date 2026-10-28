import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/shared/PrintButton";
import { requireUser } from "@/lib/auth-guards";
import { LOGO_DESKTOP_URL } from "@/lib/logo";
import { getOwnerInvoice } from "@/lib/owner-billing";

export const dynamic = "force-dynamic";

const naira = (value: number, currency: string) =>
	new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		minimumFractionDigits: 2,
	}).format(value);

function day(iso: string) {
	return new Intl.DateTimeFormat("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "Africa/Lagos",
	}).format(new Date(iso));
}

const STAMP = {
	PAID: { label: "Paid", className: "border-emerald-600 text-emerald-700" },
	REFUSED: { label: "Not applied", className: "border-red-600 text-red-700" },
	REFUNDED: { label: "Refunded", className: "border-slate-500 text-slate-600" },
} as const;

export default async function InvoicePage({
	params,
}: {
	params: Promise<{ slug: string; id: string }>;
}) {
	const user = await requireUser();
	const { slug, id } = await params;
	const data = await getOwnerInvoice(slug, user.id, id);
	if (!data) notFound();
	const { invoice, billedTo, issuer } = data;
	const stamp = STAMP[invoice.status];

	return (
		<div className="mx-auto grid max-w-3xl gap-4 print:max-w-none">
			<div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
				<Link
					href={`/dashboard/${slug}/billing`}
					className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-900"
				>
					<ArrowLeft className="size-3.5" aria-hidden="true" />
					Billing
				</Link>
				<PrintButton label="Download / print" />
			</div>

			<article className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-800 sm:p-10 print:rounded-none print:border-0 print:p-0">
				<header className="flex flex-wrap items-start justify-between gap-6">
					<div>
						{/* biome-ignore lint/performance/noImgElement: prints reliably without image optimisation */}
						<img
							src={LOGO_DESKTOP_URL}
							alt={issuer.tradingAs}
							className="h-7 w-auto"
						/>
						<div className="mt-3 text-xs leading-5 text-slate-500">
							<p className="font-bold text-slate-700">{issuer.name}</p>
							{issuer.address ? <p>{issuer.address}</p> : null}
							{issuer.rcNumber ? <p>RC {issuer.rcNumber}</p> : null}
							<p>{issuer.email}</p>
						</div>
					</div>
					<div className="text-right">
						<p className="text-2xl font-black tracking-tight text-slate-950">
							{invoice.status === "PAID" ? "Receipt" : "Invoice"}
						</p>
						<p className="mt-1 font-mono text-xs font-bold text-slate-600">
							{invoice.number}
						</p>
						<span
							className={`mt-3 inline-block rotate-[-4deg] rounded-md border-2 px-3 py-1 text-sm font-black uppercase tracking-widest ${stamp.className}`}
						>
							{stamp.label}
						</span>
					</div>
				</header>

				<section className="mt-8 grid gap-6 sm:grid-cols-2">
					<div>
						<p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
							Billed to
						</p>
						<div className="mt-1.5 text-sm leading-6">
							<p className="font-bold text-slate-900">
								{billedTo.restaurantName}
							</p>
							{billedTo.ownerName ? <p>{billedTo.ownerName}</p> : null}
							<p>{billedTo.email}</p>
							{billedTo.address ? <p>{billedTo.address}</p> : null}
							{billedTo.phone ? <p>{billedTo.phone}</p> : null}
						</div>
					</div>
					<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm sm:justify-self-end">
						<dt className="text-slate-500">Date</dt>
						<dd className="font-semibold text-slate-900">
							{day(invoice.issuedAt)}
						</dd>
						<dt className="text-slate-500">Payment reference</dt>
						<dd className="break-all font-mono text-xs font-semibold text-slate-900">
							{invoice.reference}
						</dd>
						{invoice.paymentMethod ? (
							<>
								<dt className="text-slate-500">Paid with</dt>
								<dd className="font-semibold text-slate-900">
									{invoice.paymentMethod}
								</dd>
							</>
						) : null}
						<dt className="text-slate-500">Processed by</dt>
						<dd className="font-semibold capitalize text-slate-900">
							{invoice.gateway.toLowerCase()}
						</dd>
					</dl>
				</section>

				<table className="mt-8 w-full text-left text-sm">
					<thead>
						<tr className="border-slate-200 border-b text-[11px] font-black uppercase tracking-widest text-slate-400">
							<th className="pb-2">Description</th>
							<th className="pb-2 text-right">Amount</th>
						</tr>
					</thead>
					<tbody>
						<tr className="border-slate-100 border-b">
							<td className="py-3">
								<p className="font-semibold text-slate-900">
									{invoice.description}
								</p>
								<p className="text-xs text-slate-500">
									AwaMenu subscription for {billedTo.restaurantName}
								</p>
							</td>
							<td className="py-3 text-right font-semibold text-slate-900">
								{naira(invoice.amount, invoice.currency)}
							</td>
						</tr>
					</tbody>
					<tfoot>
						<tr>
							<td className="pt-4 text-right text-sm font-bold text-slate-500">
								Total
							</td>
							<td className="pt-4 text-right text-lg font-black text-slate-950">
								{naira(invoice.amount, invoice.currency)}
							</td>
						</tr>
						{invoice.status === "PAID" ? (
							<tr>
								<td className="pt-1 text-right text-sm font-bold text-slate-500">
									Amount paid
								</td>
								<td className="pt-1 text-right text-sm font-bold text-emerald-700">
									{naira(invoice.amount, invoice.currency)}
								</td>
							</tr>
						) : null}
					</tfoot>
				</table>

				{invoice.status === "REFUSED" ? (
					<p className="mt-6 rounded-lg bg-red-50 p-3 text-xs font-medium text-red-800">
						This payment didn&apos;t match the plan price, so it wasn&apos;t
						applied to your subscription. Our team reviews these; contact{" "}
						{issuer.email} if you need help.
					</p>
				) : null}

				<footer className="mt-10 border-slate-100 border-t pt-4 text-xs leading-5 text-slate-500">
					Thank you for using {issuer.tradingAs}. Questions about this{" "}
					{invoice.status === "PAID" ? "receipt" : "invoice"}? Email{" "}
					{issuer.email} and quote {invoice.number}.
				</footer>
			</article>
		</div>
	);
}
