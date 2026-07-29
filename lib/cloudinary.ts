import crypto from "node:crypto";
import { requireEnv } from "@/env";

type SignedUploadInput = {
	folder: string;
	publicId: string;
};

export function createCloudinarySignedUpload(input: SignedUploadInput) {
	const cloudName = requireEnv("CLOUDINARY_CLOUD_NAME");
	const apiKey = requireEnv("CLOUDINARY_API_KEY");
	const apiSecret = requireEnv("CLOUDINARY_API_SECRET");
	const timestamp = Math.round(Date.now() / 1000);
	const paramsToSign = {
		folder: input.folder,
		public_id: input.publicId,
		timestamp,
	};
	const signaturePayload = Object.entries(paramsToSign)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, value]) => `${key}=${value}`)
		.join("&");
	const signature = crypto
		.createHash("sha1")
		.update(`${signaturePayload}${apiSecret}`)
		.digest("hex");

	return {
		apiKey,
		cloudName,
		folder: input.folder,
		publicId: input.publicId,
		signature,
		timestamp,
		uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
	};
}
