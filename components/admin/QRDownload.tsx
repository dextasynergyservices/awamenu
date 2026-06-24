"use client";

import { Download } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useId, useState } from "react";
import { LoadingButton } from "@/components/ui/action-button";

type QRDownloadProps = {
	restaurantName: string;
	qrUrl: string;
};

export function QRDownload({ restaurantName, qrUrl }: QRDownloadProps) {
	const qrId = useId().replace(/:/g, "");
	const [isPreparing, setIsPreparing] = useState(false);
	const [isDownloaded, setIsDownloaded] = useState(false);

	function downloadQr() {
		setIsPreparing(true);
		setIsDownloaded(false);
		const svg = document.getElementById(qrId);
		if (!(svg instanceof SVGElement)) {
			setIsPreparing(false);
			return;
		}

		const source = new XMLSerializer().serializeToString(svg);
		const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.href = url;
		link.download = `${restaurantName.toLowerCase().replace(/\s+/g, "-")}-qr.svg`;
		link.click();
		URL.revokeObjectURL(url);
		window.setTimeout(() => {
			setIsPreparing(false);
			setIsDownloaded(true);
			window.setTimeout(() => setIsDownloaded(false), 900);
		}, 250);
	}

	return (
		<div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
			<div className="flex items-center gap-4">
				<div className="rounded-xl bg-white p-2">
					<QRCodeSVG id={qrId} value={qrUrl} size={88} marginSize={1} />
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-black text-emerald-950">Menu QR</p>
					<p className="mt-1 truncate text-xs font-medium text-emerald-800">
						{qrUrl}
					</p>
					<LoadingButton
						type="button"
						onClick={downloadQr}
						loading={isPreparing}
						success={isDownloaded}
						loadingText="Preparing..."
						successText="Downloaded"
						className="mt-3 inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-black text-white"
					>
						<Download className="size-4" aria-hidden="true" />
						Download
					</LoadingButton>
				</div>
			</div>
		</div>
	);
}
