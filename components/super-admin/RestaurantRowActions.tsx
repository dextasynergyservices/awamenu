"use client";

import {
	CreditCard,
	ExternalLink,
	Mail,
	Percent,
	PlayCircle,
	ShieldOff,
	Store,
} from "lucide-react";
import { useState } from "react";
import { toggleRestaurantActiveAction } from "@/actions/super-admin.actions";
import {
	CommissionDialog,
	type CommissionState,
} from "@/components/super-admin/CommissionDialog";
import { SuspendRestaurantDialog } from "@/components/super-admin/SuspendRestaurantButton";
import {
	RowActionButton,
	RowActionForm,
	RowActionLink,
	RowActionSeparator,
	RowActions,
} from "@/components/ui/RowActions";

export function RestaurantRowActions({
	restaurant,
	commission,
	platformPercent,
}: {
	restaurant: {
		id: string;
		name: string;
		slug: string;
		isActive: boolean;
		ownerEmail: string;
	};
	commission: CommissionState;
	platformPercent: number;
}) {
	const [dialog, setDialog] = useState<"suspend" | "commission" | null>(null);

	return (
		<>
			<RowActions label={`Actions for ${restaurant.name}`}>
				<RowActionLink
					icon={Store}
					href={`/super-admin/restaurants/${restaurant.id}`}
				>
					Open details
				</RowActionLink>
				<RowActionLink
					icon={ExternalLink}
					href={`/${restaurant.slug}`}
					external
				>
					View storefront
				</RowActionLink>
				<RowActionLink
					icon={CreditCard}
					href={`/super-admin/subscriptions?q=${encodeURIComponent(restaurant.slug)}`}
				>
					Subscription
				</RowActionLink>
				<RowActionLink
					icon={Mail}
					href={`mailto:${restaurant.ownerEmail}`}
					external
				>
					Email owner
				</RowActionLink>
				<RowActionButton
					icon={Percent}
					onSelect={() => setDialog("commission")}
				>
					Commission…
				</RowActionButton>
				<RowActionSeparator />
				{restaurant.isActive ? (
					<RowActionButton
						icon={ShieldOff}
						tone="danger"
						onSelect={() => setDialog("suspend")}
					>
						Suspend…
					</RowActionButton>
				) : (
					<RowActionForm
						icon={PlayCircle}
						tone="success"
						action={toggleRestaurantActiveAction}
						fields={{ restaurantId: restaurant.id, isActive: "true" }}
						confirm={`Restore ${restaurant.name}? The menu, ordering and dashboard reopen now.`}
					>
						Restore
					</RowActionForm>
				)}
			</RowActions>

			<SuspendRestaurantDialog
				open={dialog === "suspend"}
				onOpenChange={(o) => setDialog(o ? "suspend" : null)}
				restaurantId={restaurant.id}
				restaurantName={restaurant.name}
			/>
			<CommissionDialog
				open={dialog === "commission"}
				onOpenChange={(o) => setDialog(o ? "commission" : null)}
				restaurantId={restaurant.id}
				restaurantName={restaurant.name}
				current={commission}
				platformPercent={platformPercent}
			/>
		</>
	);
}
