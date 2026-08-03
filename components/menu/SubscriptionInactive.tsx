import { Store } from "lucide-react";

export function SubscriptionInactive({
	restaurantName,
}: {
	restaurantName: string;
}) {
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 text-center">
			<div className="flex size-16 items-center justify-center rounded-2xl bg-slate-200 text-slate-500 mb-6">
				<Store className="size-8" />
			</div>
			<h1 className="text-2xl font-black text-slate-950 sm:text-3xl">
				{restaurantName} is Currently Unavailable
			</h1>
			<p className="mt-4 max-w-md text-slate-500">
				This restaurant&apos;s menu is temporarily offline. Please check back
				later or contact the restaurant directly for orders.
			</p>
			{/* Attribution intentionally omitted here — the storefront layout
			    renders it for every route, and a lapsed restaurant resolves to
			    Free, so hardcoding it again would double it up. */}
		</div>
	);
}
