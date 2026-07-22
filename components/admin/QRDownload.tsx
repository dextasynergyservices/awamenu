"use client";

import { Download } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
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
		const canvas = document.getElementById(qrId) as HTMLCanvasElement | null;
		if (!canvas) {
			setIsPreparing(false);
			return;
		}

		const url = canvas.toDataURL("image/png");
		const link = document.createElement("a");
		link.href = url;
		link.download = `${restaurantName.toLowerCase().replace(/\s+/g, "-")}-qr.png`;
		link.click();
		window.setTimeout(() => {
			setIsPreparing(false);
			setIsDownloaded(true);
			window.setTimeout(() => setIsDownloaded(false), 900);
		}, 250);
	}

	return (
		<div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-2.5 sm:p-4">
			<div className="flex items-center gap-3 sm:gap-4">
				<div className="rounded-xl bg-white p-1.5 sm:p-2">
					<QRCodeCanvas
						id={qrId}
						value={qrUrl}
						size={60}
						className="sm:h-[88px] sm:w-[88px]"
						marginSize={1}
					/>
				</div>
				<div className="min-w-0 flex-1">
					<p className="text-xs font-black text-indigo-950 sm:text-sm">
						Menu QR
					</p>
					<p className="truncate text-xs font-medium text-indigo-700 sm:mt-1">
						{qrUrl}
					</p>
					<LoadingButton
						type="button"
						onClick={downloadQr}
						loading={isPreparing}
						success={isDownloaded}
						loadingText="Preparing..."
						successText="Downloaded"
						className="mt-2 inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-700 sm:min-h-10 sm:w-auto sm:rounded-xl sm:text-sm sm:px-4"
					>
						<Download className="size-3 sm:size-4" aria-hidden="true" />
						Download
					</LoadingButton>
				</div>
			</div>
		</div>
	);
}
