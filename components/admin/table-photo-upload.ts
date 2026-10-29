import { uploadImage, webpUrl } from "@/lib/image-upload";

export async function uploadTablePhoto(restaurantId: string, file: File) {
	return webpUrl(await uploadImage({ restaurantId, kind: "table" }, file));
}
