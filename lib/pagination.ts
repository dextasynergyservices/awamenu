/**
 * Page-number pagination for server-rendered lists.
 *
 * State lives in the URL (`?page=3&size=50`), so a refresh, the back button
 * or a shared link lands on the same page, and every other filter in the
 * query string is kept when paging. Offset paging is fine at this scale and
 * gives owners the "page 3 of 12" they expect; every list it's used on is
 * backed by an index on its sort column.
 */

export const PAGE_SIZES = [25, 50, 100] as const;

export type PageRequest = {
	page: number;
	pageSize: number;
	skip: number;
	take: number;
};

export function parsePage(
	params: { page?: string | string[]; size?: string | string[] },
	defaultSize: number = PAGE_SIZES[0],
): PageRequest {
	const first = (v: string | string[] | undefined) =>
		Array.isArray(v) ? v[0] : v;
	const page = Math.max(1, Math.floor(Number(first(params.page)) || 1));
	const requested = Number(first(params.size));
	const pageSize = (PAGE_SIZES as readonly number[]).includes(requested)
		? requested
		: defaultSize;
	return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}

export type PageInfo = {
	page: number;
	pageSize: number;
	total: number;
	pageCount: number;
	from: number;
	to: number;
};

export function pageInfo(request: PageRequest, total: number): PageInfo {
	const pageCount = Math.max(1, Math.ceil(total / request.pageSize));
	const page = Math.min(request.page, pageCount);
	return {
		page,
		pageSize: request.pageSize,
		total,
		pageCount,
		from: total === 0 ? 0 : (page - 1) * request.pageSize + 1,
		to: Math.min(total, page * request.pageSize),
	};
}

/**
 * A page past the end (e.g. after a filter shrank the list) shows the last
 * page instead of an empty one.
 */
export function clampPage(request: PageRequest, total: number): PageRequest {
	const last = Math.max(1, Math.ceil(total / request.pageSize));
	if (request.page <= last) return request;
	return { ...request, page: last, skip: (last - 1) * request.pageSize };
}

/** Builds a URL for the same list with some query values changed. */
export function withQuery(
	basePath: string,
	current: Record<string, string | string[] | undefined>,
	changes: Record<string, string | number | null | undefined>,
) {
	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(current)) {
		if (value === undefined || key in changes) continue;
		for (const v of Array.isArray(value) ? value : [value]) {
			if (v !== "") params.append(key, v);
		}
	}
	for (const [key, value] of Object.entries(changes)) {
		if (value === null || value === undefined || value === "") continue;
		params.set(key, String(value));
	}
	// Page 1 is the default; keep links tidy.
	if (params.get("page") === "1") params.delete("page");
	const query = params.toString();
	return query ? `${basePath}?${query}` : basePath;
}

/** Page numbers to show, with gaps: 1 … 4 5 [6] 7 8 … 20. */
export function pageWindow(
	page: number,
	pageCount: number,
): Array<number | "gap"> {
	const pages = new Set<number>([1, pageCount]);
	for (let p = page - 2; p <= page + 2; p++) {
		if (p >= 1 && p <= pageCount) pages.add(p);
	}
	const sorted = [...pages].sort((a, b) => a - b);
	const out: Array<number | "gap"> = [];
	for (const [i, p] of sorted.entries()) {
		if (i > 0 && p - sorted[i - 1] > 1) out.push("gap");
		out.push(p);
	}
	return out;
}
