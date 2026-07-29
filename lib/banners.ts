export type BannerPosition = "left" | "center" | "right";
export type BannerSize = "fill" | "reduce";

export type BannerItem = {
	id?: string;
	url: string;
	title?: string | null;
	subtitle?: string | null;
	mobilePosition: BannerPosition;
	desktopPosition: BannerPosition;
	size: BannerSize;
};

const bannerPositions: BannerPosition[] = ["left", "center", "right"];
const bannerSizes: BannerSize[] = ["fill", "reduce"];

function isUrl(value: string) {
	try {
		new URL(value);
		return true;
	} catch {
		return false;
	}
}

function getBannerPosition(value: unknown, fallback: BannerPosition) {
	return typeof value === "string" &&
		bannerPositions.includes(value as BannerPosition)
		? (value as BannerPosition)
		: fallback;
}

function getBannerSize(value: unknown) {
	return typeof value === "string" && bannerSizes.includes(value as BannerSize)
		? (value as BannerSize)
		: "fill";
}

export function createBannerItem(url: string): BannerItem {
	return {
		url,
		title: null,
		subtitle: null,
		mobilePosition: "left",
		desktopPosition: "center",
		size: "fill",
	};
}

function normalizeBannerItem(item: unknown): BannerItem | null {
	if (typeof item === "string") {
		return isUrl(item) ? createBannerItem(item) : null;
	}

	if (!item || typeof item !== "object") return null;

	const banner = item as {
		url?: unknown;
		title?: unknown;
		subtitle?: unknown;
		mobilePosition?: unknown;
		desktopPosition?: unknown;
		size?: unknown;
	};

	if (typeof banner.url !== "string" || !isUrl(banner.url)) return null;

	return {
		url: banner.url,
		title: typeof banner.title === "string" ? banner.title : null,
		subtitle: typeof banner.subtitle === "string" ? banner.subtitle : null,
		mobilePosition: getBannerPosition(banner.mobilePosition, "left"),
		desktopPosition: getBannerPosition(banner.desktopPosition, "center"),
		size: getBannerSize(banner.size),
	};
}

export function bannerRecordToItem(banner: {
	id: string;
	imageUrl: string;
	title: string | null;
	subtitle: string | null;
	sortOrder?: number;
	isActive?: boolean;
}): BannerItem {
	return {
		id: banner.id,
		url: banner.imageUrl,
		title: banner.title,
		subtitle: banner.subtitle,
		mobilePosition: "left",
		desktopPosition: "center",
		size: "fill",
	};
}

export function parseBannerItems(
	value: string | null | undefined,
): BannerItem[] {
	if (!value) return [];

	const trimmed = value.trim();
	if (!trimmed) return [];

	if (trimmed.startsWith("[")) {
		try {
			const parsed = JSON.parse(trimmed);
			if (!Array.isArray(parsed)) return [];

			return parsed
				.map((item) => normalizeBannerItem(item))
				.filter((item): item is BannerItem => Boolean(item));
		} catch {
			return [];
		}
	}

	if (trimmed.startsWith("{")) {
		try {
			const parsed = JSON.parse(trimmed);
			const banner = normalizeBannerItem(parsed);
			return banner ? [banner] : [];
		} catch {
			return [];
		}
	}

	return isUrl(trimmed) ? [createBannerItem(trimmed)] : [];
}

export function parseBannerUrls(value: string | null | undefined) {
	return parseBannerItems(value).map((banner) => banner.url);
}

export function getBannerObjectFit(size: BannerSize) {
	return size === "reduce" ? "contain" : "cover";
}

export function getBannerObjectPosition(position: BannerPosition) {
	return `${position} center`;
}

export function serializeBannerItems(items: BannerItem[]) {
	const seenUrls = new Set<string>();
	const banners = items.filter((item) => {
		if (!isUrl(item.url) || seenUrls.has(item.url)) return false;
		seenUrls.add(item.url);
		return true;
	});

	if (banners.length === 0) return null;

	return JSON.stringify(banners);
}

export function serializeBannerUrls(urls: string[]) {
	const uniqueUrls = Array.from(new Set(urls.filter(isUrl)));

	if (uniqueUrls.length === 0) return null;
	return serializeBannerItems(uniqueUrls.map((url) => createBannerItem(url)));
}
