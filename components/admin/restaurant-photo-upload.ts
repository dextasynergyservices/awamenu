import { uploadImage, webpUrl } from "@/lib/image-upload";

export async function uploadRestaurantPhoto(
	restaurantId: string,
	kind: "logo" | "cover",
	file: File,
) {
	return webpUrl(await uploadImage({ restaurantId, kind }, file));
}
