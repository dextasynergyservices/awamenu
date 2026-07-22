import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("123456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

/**
 * Generates a unique 6-character staff ID.
 * Removes confusing characters (0, O, I) to make it easier to read/type.
 */
export function generateStaffId(
	_restaurantSlug?: string,
	_sequence?: number,
): string {
	return nanoid();
}
