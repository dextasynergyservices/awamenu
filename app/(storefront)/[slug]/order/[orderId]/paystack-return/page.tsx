import { redirect } from "next/navigation";
import {
	referenceFromReturnParams,
	verifyOrderPaymentReference,
} from "@/lib/payments";

/**
 * Where every provider returns the customer after an order checkout. The name
 * is historical; Flutterwave and Monnify land here too, each with its own
 * query parameter for the reference.
 */
type PaymentReturnPageProps = {
	params: Promise<{ slug: string; orderId: string }>;
	searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PaymentReturnPage({
	params,
	searchParams,
}: PaymentReturnPageProps) {
	const { slug, orderId } = await params;
	const reference = referenceFromReturnParams(await searchParams);

	if (reference) {
		await verifyOrderPaymentReference({ orderId, reference });
	}

	redirect(`/${slug}/order/${orderId}`);
}
