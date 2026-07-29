"use client";

import { Download, Printer, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type ReceiptItem = {
	name: string;
	qty: number;
	unitPrice: number;
	notes?: string | null;
};

type ReceiptData = {
	orderId: string;
	orderCode: string;
	receiptTitle?: string;
	trackingLabel?: string;
	totalLabel?: string;
	itemsLabel?: string;
	restaurantName: string;
	customerName: string;
	status: string;
	paymentStatus: string;
	orderType: string;
	total: number;
	currency: string;
	createdAt: string;
	items: ReceiptItem[];
	extraDetails?: Array<{
		label: string;
		value: string;
	}>;
	payments?: Array<{
		method: string;
		amount: string | number;
	}>;
};

type ReceiptActionsProps = {
	receipt: ReceiptData;
	hidePrint?: boolean;
	hideDownload?: boolean;
	hideShare?: boolean;
	size?: "sm" | "default";
};

type ReceiptFormat = "image" | "pdf";

function formatMoney(value: number, currency: string) {
	return new Intl.NumberFormat("en-NG", {
		style: "currency",
		currency,
		maximumFractionDigits: 0,
	}).format(value);
}

function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	link.remove();
	URL.revokeObjectURL(url);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string) {
	return new Promise<Blob>((resolve, reject) => {
		canvas.toBlob((blob) => {
			if (blob) resolve(blob);
			else reject(new Error("Unable to create receipt file."));
		}, type);
	});
}

function getWrappedLines(
	context: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
) {
	const words = text.split(" ");
	const lines: string[] = [];
	let line = "";

	for (const word of words) {
		const testLine = line ? `${line} ${word}` : word;
		if (context.measureText(testLine).width > maxWidth && line) {
			lines.push(line);
			line = word;
		} else {
			line = testLine;
		}
	}

	if (line) lines.push(line);
	return lines;
}

function drawWrappedLines(
	context: CanvasRenderingContext2D,
	lines: string[],
	x: number,
	y: number,
	lineHeight: number,
) {
	let cursorY = y;
	for (const line of lines) {
		context.fillText(line, x, cursorY);
		cursorY += lineHeight;
	}
	return cursorY;
}

function _roundedRect(
	context: CanvasRenderingContext2D,
	x: number,
	y: number,
	width: number,
	height: number,
	radius: number,
) {
	context.beginPath();
	context.moveTo(x + radius, y);
	context.lineTo(x + width - radius, y);
	context.quadraticCurveTo(x + width, y, x + width, y + radius);
	context.lineTo(x + width, y + height - radius);
	context.quadraticCurveTo(
		x + width,
		y + height,
		x + width - radius,
		y + height,
	);
	context.lineTo(x + radius, y + height);
	context.quadraticCurveTo(x, y + height, x, y + height - radius);
	context.lineTo(x, y + radius);
	context.quadraticCurveTo(x, y, x + radius, y);
	context.closePath();
}

function buildReceiptCanvas(receipt: ReceiptData) {
	// Standard thermal receipt width (80mm) is ~384px at 203 DPI. Let's use 400px.
	const width = 400;
	const padding = 24;
	const contentWidth = width - padding * 2;
	const contentX = padding;
	const amountX = width - padding;

	const measureCanvas = document.createElement("canvas");
	const measureContext = measureCanvas.getContext("2d");

	if (!measureContext) {
		throw new Error("Unable to prepare receipt image.");
	}

	measureContext.font = "bold 20px monospace";
	const itemLayouts = receipt.items.map((item) => {
		const nameLines = getWrappedLines(
			measureContext,
			item.name,
			contentWidth - 100,
		);
		const noteLines = item.notes
			? getWrappedLines(
					measureContext,
					`Note: ${item.notes}`,
					contentWidth - 100,
				)
			: [];
		const height = nameLines.length * 24 + noteLines.length * 20 + 20;

		return { item, nameLines, noteLines, height };
	});

	const itemsHeight = itemLayouts.reduce(
		(total, item) => total + item.height,
		0,
	);
	const extraDetailLines =
		receipt.extraDetails?.map((detail) => `${detail.label}: ${detail.value}`) ??
		[];
	const headerHeight = 220 + extraDetailLines.length * 24;

	let paymentsHeight = 0;
	if (
		receipt.paymentStatus === "PAID" &&
		receipt.payments &&
		receipt.payments.length > 0
	) {
		paymentsHeight = receipt.payments.length * 24 + 48; // Space for breakdown
	}

	const totalHeight = 80;
	const height =
		padding +
		headerHeight +
		itemsHeight +
		totalHeight +
		paymentsHeight +
		padding +
		60; // Extra padding at bottom

	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");

	if (!context) {
		throw new Error("Unable to prepare receipt image.");
	}

	// Fill white background for thermal printer
	context.fillStyle = "#ffffff";
	context.fillRect(0, 0, width, height);

	// Draw Header
	context.fillStyle = "#000000";
	context.textAlign = "center";
	context.font = "bold 28px monospace";
	context.fillText(receipt.restaurantName, width / 2, padding + 30);

	const isPaid = receipt.paymentStatus === "PAID";
	const receiptTitle = isPaid ? "RECEIPT" : "INVOICE";

	context.font = "bold 24px monospace";
	context.fillText(receiptTitle, width / 2, padding + 70);
	context.font = "bold 20px monospace";
	context.fillText(`Order: ${receipt.orderCode}`, width / 2, padding + 100);

	// Draw dashed line
	context.textAlign = "left";
	context.font = "bold 16px monospace";
	function drawDashedLine(y: number) {
		context?.fillText("-".repeat(44), contentX, y);
	}

	drawDashedLine(padding + 130);

	// Draw details
	context.font = "18px monospace";
	const detailLines = [
		`Customer: ${receipt.customerName}`,
		`Type: ${receipt.orderType.replace("_", " ")}`,
		`Status: ${receipt.status.replace("_", " ")}`,
		`Date: ${new Date(receipt.createdAt).toLocaleString("en-NG", {
			dateStyle: "short",
			timeStyle: "short",
		})}`,
		...extraDetailLines,
	];

	detailLines.forEach((line, index) => {
		context?.fillText(line, contentX, padding + 160 + index * 24);
	});

	const itemsHeaderY = padding + 160 + detailLines.length * 24;
	drawDashedLine(itemsHeaderY);

	context.font = "bold 18px monospace";
	context.fillText(receipt.itemsLabel ?? "Items", contentX, itemsHeaderY + 24);
	drawDashedLine(itemsHeaderY + 48);

	// Draw Items
	let y = itemsHeaderY + 76;
	for (const { item, nameLines, noteLines, height: rowHeight } of itemLayouts) {
		context.font = "bold 18px monospace";
		const nextY = drawWrappedLines(context, nameLines, contentX, y, 24);

		context.font = "16px monospace";
		context.fillText(`x${item.qty}`, contentX, nextY + 4);

		if (noteLines.length > 0) {
			context.font = "italic 14px monospace";
			drawWrappedLines(context, noteLines, contentX, nextY + 24, 20);
		}

		context.font = "bold 18px monospace";
		context.textAlign = "right";
		context.fillText(
			formatMoney(item.unitPrice * item.qty, receipt.currency),
			amountX,
			y,
		);
		context.textAlign = "left";

		y += rowHeight;
	}

	drawDashedLine(y);
	y += 24;

	// Total
	context.font = "bold 24px monospace";
	context.fillText(receipt.totalLabel ?? "Total", contentX, y + 20);
	context.textAlign = "right";
	context.fillText(
		formatMoney(receipt.total, receipt.currency),
		amountX,
		y + 20,
	);
	context.textAlign = "left";
	y += 40;

	// Payments Breakdown (if paid)
	if (isPaid && receipt.payments && receipt.payments.length > 0) {
		drawDashedLine(y);
		y += 30;
		context.font = "bold 18px monospace";
		context.fillText("Payments", contentX, y);
		y += 24;

		let totalPaid = 0;
		context.font = "16px monospace";
		for (const payment of receipt.payments) {
			const amount = Number(payment.amount);
			totalPaid += amount;
			context.fillText(payment.method, contentX, y);
			context.textAlign = "right";
			context.fillText(formatMoney(amount, receipt.currency), amountX, y);
			context.textAlign = "left";
			y += 24;
		}

		drawDashedLine(y);
		y += 24;
		context.font = "bold 18px monospace";
		context.fillText("Balance", contentX, y);
		context.textAlign = "right";
		context.fillText(
			formatMoney(Math.max(0, receipt.total - totalPaid), receipt.currency),
			amountX,
			y,
		);
		context.textAlign = "left";
		y += 30;
	}

	drawDashedLine(y);
	context.textAlign = "center";
	context.font = "italic 16px monospace";
	context.fillText("Thank you for your business!", width / 2, y + 30);

	return canvas;
}

function base64ToUint8Array(base64: string) {
	const binary = window.atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let index = 0; index < binary.length; index++) {
		bytes[index] = binary.charCodeAt(index);
	}
	return bytes;
}

function buildPdfBlob(canvas: HTMLCanvasElement) {
	const imageData = canvas.toDataURL("image/jpeg", 0.95).split(",")[1];
	const imageBytes = base64ToUint8Array(imageData);
	const pageWidth = 595;
	const pageHeight = Math.round((pageWidth * canvas.height) / canvas.width);
	const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im1 Do\nQ`;
	const encoder = new TextEncoder();
	const chunks: BlobPart[] = ["%PDF-1.4\n"];
	const offsets: number[] = [0];
	let length = encoder.encode("%PDF-1.4\n").length;

	function pushPart(part: string | Uint8Array) {
		chunks.push(typeof part === "string" ? part : Uint8Array.from(part).buffer);
		length +=
			typeof part === "string" ? encoder.encode(part).length : part.length;
	}

	function addObject(id: number, parts: Array<string | Uint8Array>) {
		offsets[id] = length;
		pushPart(`${id} 0 obj\n`);
		for (const part of parts) {
			pushPart(part);
		}
		pushPart("\nendobj\n");
	}

	addObject(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
	addObject(2, ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]);
	addObject(3, [
		`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>`,
	]);
	addObject(4, [
		`<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imageBytes.length} >>\nstream\n`,
		imageBytes,
		"\nendstream",
	]);
	addObject(5, [
		`<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
	]);

	const xrefOffset = length;
	const xref = [
		"xref",
		"0 6",
		"0000000000 65535 f ",
		...offsets
			.slice(1)
			.map((offset) => `${String(offset).padStart(10, "0")} 00000 n `),
		"trailer",
		"<< /Size 6 /Root 1 0 R >>",
		"startxref",
		String(xrefOffset),
		"%%EOF",
	].join("\n");

	return new Blob([...chunks, xref], { type: "application/pdf" });
}

export function ReceiptActions({
	receipt,
	hidePrint,
	hideDownload,
	hideShare,
	size = "default",
}: ReceiptActionsProps) {
	const [downloadOpen, setDownloadOpen] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);
	const filename = useMemo(
		() => `receipt-${receipt.orderCode.replace("#", "")}`,
		[receipt.orderCode],
	);
	const docLabel = receipt.paymentStatus === "PAID" ? "Receipt" : "Invoice";

	async function handlePrint() {
		const canvas = buildReceiptCanvas(receipt);
		const dataUrl = canvas.toDataURL("image/png");

		const printWindow = window.open("", "_blank");
		if (printWindow) {
			printWindow.document.write(`
				<html>
					<head>
						<title>${receipt.receiptTitle ?? "Receipt"} ${receipt.orderCode}</title>
						<style>
							@page { margin: 0; }
							body { margin: 0; padding: 20px; display: flex; justify-content: center; background: #eee; }
							img { max-width: 100%; height: auto; box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1); }
							@media print {
								body { background: white; padding: 0; }
								img { box-shadow: none; }
							}
						</style>
					</head>
					<body>
						<img src="${dataUrl}" />
						<script>
							window.onload = () => {
								window.print();
								setTimeout(() => window.close(), 500);
							};
						</script>
					</body>
				</html>
			`);
			printWindow.document.close();
		}
	}

	async function createReceiptBlob(format: ReceiptFormat) {
		const canvas = buildReceiptCanvas(receipt);
		if (format === "pdf") {
			return {
				blob: buildPdfBlob(canvas),
				name: `${filename}.pdf`,
				type: "application/pdf",
			};
		}

		return {
			blob: await canvasToBlob(canvas, "image/png"),
			name: `${filename}.png`,
			type: "image/png",
		};
	}

	async function handleDownload(format: ReceiptFormat) {
		const file = await createReceiptBlob(format);
		downloadBlob(file.blob, file.name);
		setDownloadOpen(false);
	}

	async function handleShare(format: ReceiptFormat) {
		const receiptFile = await createReceiptBlob(format);
		const file = new File([receiptFile.blob], receiptFile.name, {
			type: receiptFile.type,
		});
		const shareData = {
			title: `${receipt.restaurantName} ${receipt.orderCode}`,
			text: `${receipt.restaurantName} ${receipt.receiptTitle ?? "receipt"} ${receipt.orderCode}`,
			files: [file],
		};

		if (navigator.canShare?.(shareData)) {
			await navigator.share(shareData);
		} else if (navigator.share) {
			await navigator.share({
				title: shareData.title,
				text: `${shareData.text} ${window.location.href}`,
				url: window.location.href,
			});
		} else {
			downloadBlob(receiptFile.blob, receiptFile.name);
		}
		setShareOpen(false);
	}

	const btnClasses =
		size === "sm"
			? "h-8 items-center gap-1.5 rounded-md px-3 text-xs"
			: "min-h-9 items-center gap-2 rounded-xl px-3 text-xs";
	const iconClasses = size === "sm" ? "size-3.5" : "size-4";
	const printBtnClasses =
		size === "sm"
			? "size-8 items-center justify-center rounded-md text-xs"
			: "size-9 items-center justify-center rounded-xl text-xs";

	return (
		<div className="mt-4 flex flex-wrap gap-2">
			{!hideDownload && (
				<div className="relative">
					<button
						type="button"
						onClick={() => {
							setDownloadOpen((value) => !value);
							setShareOpen(false);
						}}
						className={cn(
							"inline-flex font-black text-white bg-emerald-700",
							btnClasses,
						)}
					>
						<Download className={iconClasses} aria-hidden="true" />
						Download {docLabel}
					</button>
					{downloadOpen ? (
						<ActionMenu
							onImage={() => handleDownload("image")}
							onPdf={() => handleDownload("pdf")}
						/>
					) : null}
				</div>
			)}

			{!hidePrint && (
				<button
					type="button"
					onClick={handlePrint}
					className={cn(
						"inline-flex font-black border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
						printBtnClasses,
					)}
					title={`Print POS ${docLabel}`}
				>
					<Printer className={iconClasses} aria-hidden="true" />
				</button>
			)}

			{!hideShare && (
				<div className="relative">
					<button
						type="button"
						onClick={() => {
							setShareOpen((value) => !value);
							setDownloadOpen(false);
						}}
						className={cn(
							"inline-flex font-black border border-emerald-100 bg-emerald-50 text-emerald-800",
							btnClasses,
						)}
					>
						<Share2 className={iconClasses} aria-hidden="true" />
						Share {docLabel}
					</button>
					{shareOpen ? (
						<ActionMenu
							align="right"
							onImage={() => handleShare("image")}
							onPdf={() => handleShare("pdf")}
						/>
					) : null}
				</div>
			)}
		</div>
	);
}

function ActionMenu({
	align = "left",
	onImage,
	onPdf,
}: {
	align?: "left" | "right";
	onImage: () => void;
	onPdf: () => void;
}) {
	return (
		<div
			className={cn(
				"absolute top-12 z-20 grid min-w-36 gap-1 rounded-xl border border-slate-100 bg-white p-1 shadow-xl",
				align === "right" ? "right-0" : "left-0",
			)}
		>
			<button
				type="button"
				onClick={onImage}
				className="rounded-lg px-3 py-2 text-left text-sm font-black text-slate-700 hover:bg-slate-50"
			>
				Image
			</button>
			<button
				type="button"
				onClick={onPdf}
				className="rounded-lg px-3 py-2 text-left text-sm font-black text-slate-700 hover:bg-slate-50"
			>
				PDF
			</button>
		</div>
	);
}
