/**
 * Browser-side image upload: asks our server to sign the upload, then sends
 * the file straight to Cloudinary. Every photo picker in the app goes through
 * here, so the checks and error messages are the same everywhere.
 *
 * Always throws an Error whose message is safe to show the user as-is.
 */

const IMAGE_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
type ImageType = (typeof IMAGE_TYPES)[number];

/** Cloudinary's per-image limit on the free plan. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

type SignedUpload = {
	apiKey: string;
	folder: string;
	publicId: string;
	signature: string;
	timestamp: number;
	uploadUrl: string;
};

type UploadTarget =
	| { restaurantId: string; kind: "logo" | "cover" | "item" | "table" }
	| { platform: true; kind: "logo" };

// Some Android pickers and file managers give no MIME type, so fall back to
// the extension rather than rejecting a perfectly good photo.
function imageType(file: File): ImageType | null {
	if ((IMAGE_TYPES as readonly string[]).includes(file.type)) {
		return file.type as ImageType;
	}
	if (file.type) return null;
	const ext = file.name.split(".").pop()?.toLowerCase();
	if (ext === "png") return "image/png";
	if (ext === "webp") return "image/webp";
	if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
	return null;
}

async function send(url: string, init: RequestInit) {
	try {
		return await fetch(url, init);
	} catch {
		throw new Error(
			"Couldn't reach the server. Check your connection and try again.",
		);
	}
}

async function errorMessage(res: Response): Promise<string | null> {
	const body = (await res.json().catch(() => null)) as {
		error?: string | { message?: string };
	} | null;
	const error = body?.error;
	return typeof error === "string" ? error : (error?.message ?? null);
}

export async function uploadImage(
	target: UploadTarget,
	file: File,
	{ maxBytes = MAX_IMAGE_BYTES }: { maxBytes?: number } = {},
): Promise<string> {
	const contentType = imageType(file);
	if (!contentType) {
		throw new Error("Use a WebP, JPG or PNG image.");
	}
	if (file.size > maxBytes) {
		const mb = Math.round(maxBytes / (1024 * 1024));
		throw new Error(`This image is too large. Keep it under ${mb} MB.`);
	}

	const signRes = await send(
		"platform" in target ? "/api/upload/platform" : "/api/upload",
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				...("platform" in target ? {} : { restaurantId: target.restaurantId }),
				kind: target.kind,
				contentType,
			}),
		},
	);
	if (!signRes.ok) {
		if (signRes.status === 401) {
			throw new Error("Your session has ended. Sign in again to upload.");
		}
		throw new Error(
			(await errorMessage(signRes)) ?? "Couldn't start the upload. Try again.",
		);
	}
	const signed = (await signRes.json()) as SignedUpload;

	const body = new FormData();
	body.set("file", file);
	body.set("api_key", signed.apiKey);
	body.set("folder", signed.folder);
	body.set("public_id", signed.publicId);
	body.set("signature", signed.signature);
	body.set("timestamp", String(signed.timestamp));

	const uploadRes = await send(signed.uploadUrl, { method: "POST", body });
	if (!uploadRes.ok) {
		// Cloudinary explains itself (e.g. "Invalid image file"); pass it on.
		const reason = await errorMessage(uploadRes);
		throw new Error(
			reason ? `Upload failed: ${reason}` : "The upload failed. Try again.",
		);
	}
	const uploaded = (await uploadRes.json().catch(() => null)) as {
		secure_url?: string;
	} | null;
	if (!uploaded?.secure_url) {
		throw new Error("The upload didn't return an image. Try again.");
	}
	return uploaded.secure_url;
}

/** Delivery URL that serves WebP at automatic quality. */
export function webpUrl(secureUrl: string) {
	return secureUrl.replace("/upload/", "/upload/f_webp,q_auto/");
}
