import { redirect } from "next/navigation";
import { verifyOrderPaymentReference } from "@/lib/payments";

type PaystackReturnPageProps = {
	params: Promise<{ slug: string; orderId: string }>;
	searchParams?: Promise<{ reference?: string; trxref?: string }>;
};

export default async function PaystackReturnPage({
	params,
	searchParams,
}: PaystackReturnPageProps) {
	const { slug, orderId } = await params;
	const { reference, trxref } = (await searchParams) ?? {};
	const paystackReference = reference ?? trxref;

	if (paystackReference) {
		await verifyOrderPaymentReference({
			orderId,
			reference: paystackReference,
		});
	}

	redirect(`/${slug}/order/${orderId}`);
}
