import { env } from "@/env";

export function getQrScanUrl(slug: string) {
	return `${env.NEXT_PUBLIC_APP_URL}/api/qr/${slug}`;
}
