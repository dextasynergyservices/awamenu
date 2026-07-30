/**
 * Deliberately renders nothing. This exists purely to be the *closest*
 * Suspense boundary around `[slug]/layout.tsx`'s own (small) restaurant
 * lookup — without it, the root `app/loading.tsx` (the generic AwaMenu
 * screen) would be the nearest boundary instead, and would flash briefly
 * before handing off to `[slug]/loading.tsx`'s restaurant-branded screen.
 * That handoff is what showed as "AwaMenu logo, then the restaurant's own
 * logo." Rendering nothing here means only the restaurant-branded fallback
 * (for the page's own, larger data fetch) is ever visible.
 */
export default function Loading() {
	return null;
}
