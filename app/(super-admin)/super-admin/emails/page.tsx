import { render } from "@react-email/components";
import Link from "next/link";
import {
	emailSamples,
	SAMPLE_BRANDS,
	type SampleBrandKey,
	sampleBrandFor,
} from "@/emails/samples";
import { env } from "@/env";
import { cn } from "@/lib/utils";

/**
 * Every email the platform sends, rendered with sample data. Guest emails can
 * be switched between restaurant brands to check colours and the
 * "Powered by AwaMenu" line.
 */
export default async function SuperAdminEmailsPage({
	searchParams,
}: {
	searchParams: Promise<{ t?: string; brand?: string }>;
}) {
	const params = await searchParams;
	const appUrl = env.NEXT_PUBLIC_APP_URL ?? "https://awamenu.com";
	const samples = emailSamples(appUrl);
	const sample = samples.find((s) => s.key === params.t) ?? samples[0];
	const brandKey: SampleBrandKey =
		params.brand && params.brand in SAMPLE_BRANDS
			? (params.brand as SampleBrandKey)
			: "branded";
	const brand = sampleBrandFor(sample, brandKey, appUrl);
	const html = await render(sample.render(brand));
	const from = sample.branded
		? `${brand.name}${brand.poweredBy ? " via AwaMenu" : ""}`
		: "AwaMenu";
	const groups = [...new Set(samples.map((s) => s.group))];
	const href = (t: string, b: SampleBrandKey) =>
		`/super-admin/emails?t=${t}${b === "branded" ? "" : `&brand=${b}`}`;

	return (
		<div className="grid gap-6">
			<div>
				<h1 className="text-2xl font-black text-slate-950 md:text-3xl">
					Emails
				</h1>
				<p className="mt-1 max-w-2xl text-sm font-medium text-slate-600">
					Every email the platform sends, with sample data. Guest emails carry
					the restaurant&apos;s name, logo and colour; &ldquo;Powered by
					AwaMenu&rdquo; shows only on plans that keep AwaMenu branding. Emails
					to owners always come from AwaMenu.
				</p>
			</div>

			<div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
				<nav aria-label="Emails" className="grid content-start gap-4">
					{groups.map((group) => (
						<div key={group}>
							<p className="px-2 text-[11px] font-black tracking-wide text-slate-400 uppercase">
								{group}
							</p>
							<ul className="mt-1 grid gap-0.5">
								{samples
									.filter((s) => s.group === group)
									.map((s) => (
										<li key={s.key}>
											<Link
												href={href(s.key, brandKey)}
												aria-current={s.key === sample.key ? "page" : undefined}
												className={cn(
													"block rounded-lg px-2 py-1.5 text-sm font-semibold",
													s.key === sample.key
														? "bg-emerald-50 text-emerald-800"
														: "text-slate-600 hover:bg-slate-100",
												)}
											>
												{s.label}
											</Link>
										</li>
									))}
							</ul>
						</div>
					))}
				</nav>

				<section className="min-w-0 rounded-2xl border border-slate-200 bg-white">
					<div className="grid gap-3 border-slate-100 border-b p-4">
						<dl className="grid gap-1 text-sm">
							<div className="flex gap-2">
								<dt className="w-16 shrink-0 font-bold text-slate-400">From</dt>
								<dd className="min-w-0 truncate font-semibold text-slate-800">
									{from}
								</dd>
							</div>
							<div className="flex gap-2">
								<dt className="w-16 shrink-0 font-bold text-slate-400">
									Subject
								</dt>
								<dd className="min-w-0 font-semibold text-slate-800">
									{sample.subject}
								</dd>
							</div>
						</dl>
						{sample.branded ? (
							<div className="flex flex-wrap gap-1.5">
								{(Object.keys(SAMPLE_BRANDS) as SampleBrandKey[]).map((key) => (
									<Link
										key={key}
										href={href(sample.key, key)}
										className={cn(
											"rounded-full border px-3 py-1 text-xs font-bold",
											key === brandKey
												? "border-emerald-600 bg-emerald-600 text-white"
												: "border-slate-200 text-slate-600 hover:bg-slate-50",
										)}
									>
										{SAMPLE_BRANDS[key]}
									</Link>
								))}
							</div>
						) : null}
					</div>
					<iframe
						title={`Preview: ${sample.label}`}
						srcDoc={html}
						sandbox=""
						className="h-[900px] w-full rounded-b-2xl"
					/>
				</section>
			</div>
		</div>
	);
}
