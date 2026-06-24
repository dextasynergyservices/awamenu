"use client";

import { Check, Copy, Download, Share2 } from "lucide-react";
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
	copyLabel?: string;
	copyValue?: string;
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
};

type ReceiptActionsProps = {
	receipt: ReceiptData;
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

function roundedRect(
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
	const width = 900;
	const outerPadding = 40;
	const cardPadding = 40;
	const cardX = 48;
	const cardY = 40;
	const cardWidth = width - 96;
	const contentX = cardX + cardPadding;
	const contentWidth = cardWidth - cardPadding * 2;
	const amountX = cardX + cardWidth - cardPadding;
	const itemTextWidth = 500;
	const measureCanvas = document.createElement("canvas");
	const measureContext = measureCanvas.getContext("2d");

	if (!measureContext) {
		throw new Error("Unable to prepare receipt image.");
	}

	measureContext.font = "900 25px Arial";
	const itemLayouts = receipt.items.map((item) => {
		const nameLines = getWrappedLines(measureContext, item.name, itemTextWidth);
		const noteLines = item.notes
			? getWrappedLines(measureContext, `Note: ${item.notes}`, itemTextWidth)
			: [];
		const height = Math.max(
			92,
			nameLines.length * 31 + noteLines.length * 24 + 44,
		);

		return { item, nameLines, noteLines, height };
	});
	const itemsHeight = itemLayouts.reduce(
		(total, item) => total + item.height,
		0,
	);
	const extraDetailLines =
		receipt.extraDetails?.map((detail) => `${detail.label}: ${detail.value}`) ??
		[];
	const headerHeight = 484 + extraDetailLines.length * 38;
	const totalHeight = 106;
	const height =
		outerPadding +
		cardPadding +
		headerHeight +
		itemsHeight +
		totalHeight +
		cardPadding +
		outerPadding;
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");

	if (!context) {
		throw new Error("Unable to prepare receipt image.");
	}

	context.fillStyle = "#f6faf7";
	context.fillRect(0, 0, width, height);
	context.fillStyle = "#ffffff";
	roundedRect(context, cardX, cardY, cardWidth, height - 80, 0);
	context.fill();
	context.strokeStyle = "#d1fae5";
	context.lineWidth = 4;
	roundedRect(context, cardX, cardY, cardWidth, height - 80, 0);
	context.stroke();

	context.fillStyle = "#047857";
	context.font = "700 30px Arial";
	context.fillText(receipt.restaurantName, contentX, 100);
	context.fillStyle = "#0f172a";
	context.font = "900 48px Arial";
	context.fillText(
		`${receipt.receiptTitle ?? "Receipt"} ${receipt.orderCode}`,
		contentX,
		164,
	);

	context.fillStyle = "#475569";
	context.font = "700 24px Arial";
	const detailLines = [
		`${receipt.trackingLabel ?? "Tracking ID"}: ${receipt.orderId}`,
		`Customer: ${receipt.customerName}`,
		`Type: ${receipt.orderType.replace("_", " ")}`,
		`Status: ${receipt.status.replace("_", " ")}`,
		`Payment: ${receipt.paymentStatus}`,
		`Date: ${new Date(receipt.createdAt).toLocaleString("en-NG", {
			dateStyle: "medium",
			timeStyle: "short",
		})}`,
		...extraDetailLines,
	];
	detailLines.forEach((line, index) => {
		context.fillText(line, contentX, 218 + index * 38);
	});

	const itemsHeaderY = 458 + extraDetailLines.length * 38;
	context.fillStyle = "#ecfdf5";
	roundedRect(context, contentX, itemsHeaderY, contentWidth, 68, 0);
	context.fill();
	context.fillStyle = "#065f46";
	context.font = "900 28px Arial";
	context.fillText(
		receipt.itemsLabel ?? "Items",
		contentX + 24,
		itemsHeaderY + 44,
	);

	let y = itemsHeaderY + 120;
	for (const { item, nameLines, noteLines, height: rowHeight } of itemLayouts) {
		context.fillStyle = "#0f172a";
		context.font = "900 25px Arial";
		const nextY = drawWrappedLines(context, nameLines, contentX, y, 31);
		context.fillStyle = "#64748b";
		context.font = "700 21px Arial";
		context.fillText(`x${item.qty}`, contentX, nextY + 8);
		if (noteLines.length > 0) {
			context.fillStyle = "#64748b";
			context.font = "700 18px Arial";
			drawWrappedLines(context, noteLines, contentX, nextY + 38, 24);
		}
		context.fillStyle = "#047857";
		context.font = "900 24px Arial";
		context.textAlign = "right";
		context.fillText(
			formatMoney(item.unitPrice * item.qty, receipt.currency),
			amountX,
			y,
		);
		context.textAlign = "left";
		context.strokeStyle = "#e2e8f0";
		context.lineWidth = 2;
		context.beginPath();
		context.moveTo(contentX, y + rowHeight - 20);
		context.lineTo(amountX, y + rowHeight - 20);
		context.stroke();
		y += rowHeight;
	}

	const totalY = y + 20;
	context.fillStyle = "#ecfdf5";
	roundedRect(context, contentX, totalY, contentWidth, 76, 0);
	context.fill();
	context.fillStyle = "#0f172a";
	context.font = "900 30px Arial";
	context.fillText(receipt.totalLabel ?? "Total", contentX + 24, totalY + 48);
	context.fillStyle = "#047857";
	context.textAlign = "right";
	context.fillText(
		formatMoney(receipt.total, receipt.currency),
		amountX - 24,
		totalY + 48,
	);
	context.textAlign = "left";

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

export function ReceiptActions({ receipt }: ReceiptActionsProps) {
	const [downloadOpen, setDownloadOpen] = useState(false);
	const [shareOpen, setShareOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const filename = useMemo(
		() => `receipt-${receipt.orderCode.replace("#", "")}`,
		[receipt.orderCode],
	);
	const copyLabel = receipt.copyLabel ?? "Copy receipt code";
	const copyValue = receipt.copyValue ?? receipt.orderCode;

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

	async function handleCopy() {
		await navigator.clipboard.writeText(copyValue);
		setCopied(true);
		window.setTimeout(() => setCopied(false), 1200);
	}

	return (
		<div className="mt-4 flex flex-wrap gap-2">
			<button
				type="button"
				onClick={handleCopy}
				aria-label={copied ? "Code copied" : copyLabel}
				title={copied ? "Copied" : copyLabel}
				className="inline-flex size-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700"
			>
				{copied ? (
					<Check className="size-4 text-emerald-700" aria-hidden="true" />
				) : (
					<Copy className="size-4" aria-hidden="true" />
				)}
			</button>

			<div className="relative">
				<button
					type="button"
					onClick={() => {
						setDownloadOpen((value) => !value);
						setShareOpen(false);
					}}
					className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-3 text-sm font-black text-white"
				>
					<Download className="size-4" aria-hidden="true" />
					Download
				</button>
				{downloadOpen ? (
					<ActionMenu
						onImage={() => handleDownload("image")}
						onPdf={() => handleDownload("pdf")}
					/>
				) : null}
			</div>

			<div className="relative">
				<button
					type="button"
					onClick={() => {
						setShareOpen((value) => !value);
						setDownloadOpen(false);
					}}
					className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 text-sm font-black text-emerald-800"
				>
					<Share2 className="size-4" aria-hidden="true" />
					Share
				</button>
				{shareOpen ? (
					<ActionMenu
						align="right"
						onImage={() => handleShare("image")}
						onPdf={() => handleShare("pdf")}
					/>
				) : null}
			</div>
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
