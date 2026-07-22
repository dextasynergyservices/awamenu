export async function uploadRestaurantPhoto(
	restaurantId: string,
	kind: "logo" | "cover",
	file: File,
) {
	if (!["image/webp", "image/jpeg", "image/png"].includes(file.type)) {
		throw new Error("Photos must be WebP, JPG, or PNG images.");
	}

	const res = await fetch("/api/upload", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			restaurantId,
			kind,
			contentType: file.type,
		}),
	});

	if (!res.ok) {
		throw new Error("Unable to create upload URL.");
	}

	const payload = (await res.json()) as {
		apiKey: string;
		folder: string;
		publicId: string;
		signature: string;
		timestamp: number;
		uploadUrl: string;
	};
	const uploadData = new FormData();
	uploadData.set("file", file);
	uploadData.set("api_key", payload.apiKey);
	uploadData.set("folder", payload.folder);
	uploadData.set("public_id", payload.publicId);
	uploadData.set("signature", payload.signature);
	uploadData.set("timestamp", String(payload.timestamp));

	const uploadRes = await fetch(payload.uploadUrl, {
		method: "POST",
		body: uploadData,
	});

	if (!uploadRes.ok) {
		throw new Error("Unable to upload photo.");
	}

	const uploadPayload = (await uploadRes.json()) as { secure_url?: string };
	if (!uploadPayload.secure_url) {
		throw new Error("Cloudinary did not return an image URL.");
	}

	return uploadPayload.secure_url.replace("/upload/", "/upload/f_webp,q_auto/");
}
