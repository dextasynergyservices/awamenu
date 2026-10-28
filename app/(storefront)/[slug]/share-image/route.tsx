import * as Sentry from "@sentry/nextjs";
import jpegJs from "jpeg-js";
import { ImageResponse } from "next/og";
import { PNG } from "pngjs";
import { brandColors } from "@/emails/brand";
import { getStorefrontShare } from "@/lib/storefront-share";

/**
 * The link-preview card for a restaurant (WhatsApp, Instagram, X, Facebook,
 * Slack, iMessage), linked from every storefront page's metadata as
 * /{slug}/share-image?v={version} (lib/storefront-share.ts).
 *
 * The version is a fingerprint of everything on the card, so a new logo,
 * cover, colour, name, address or dish photo gives a new URL at once, and each
 * URL can be cached for good. (Next's opengraph-image file convention can't
 * do this: its URL doesn't change with the content, so it had to be cached
 * for a short time and still went stale.)
 *
 * Cover photo with the logo, name and what you can do there; a brand-colour
 * card when there's no photo. "Powered by AwaMenu" only on plans that keep
 * AwaMenu branding.
 */

const size = { width: 1200, height: 630 };

/**
 * Cloudinary images are stored as WebP, which the image renderer can't read.
 * Ask Cloudinary for a JPG/PNG of the right size instead.
 */
function cloudinary(url: string, transform: string) {
	const match = url.match(
		/^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(.+)$/,
	);
	if (!match) return url;
	const parts = match[2].split("/");
	// Drop existing transformations (f_webp,q_auto…) up to the version or path.
	while (
		parts.length > 1 &&
		!/^v\d+$/.test(parts[0]) &&
		/^[a-z]{1,3}_/.test(parts[0])
	) {
		parts.shift();
	}
	return `${match[1]}${transform}/${parts.join("/")}`;
}

/** "#047857" → "rgba(4,120,87,0.5)" (the renderer has no colour-mix). */
function rgba(hex: string, alpha: number) {
	const n = Number.parseInt(hex.slice(1), 16);
	return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Fetches an image as a data URL, only if it's a PNG or JPEG under 4 MB. */
async function inline(url: string | null, transform: string) {
	if (!url || !/^https:\/\//.test(url)) return null;
	try {
		const res = await fetch(cloudinary(url, transform), {
			signal: AbortSignal.timeout(5000),
		});
		const type = res.headers.get("content-type") ?? "";
		if (!res.ok || !/^image\/(png|jpe?g)/.test(type)) return null;
		const buffer = await res.arrayBuffer();
		if (buffer.byteLength > 4 * 1024 * 1024) return null;
		return `data:${type};base64,${Buffer.from(buffer).toString("base64")}`;
	} catch {
		return null;
	}
}

/** Montserrat (the storefront's font) as TTF, which the renderer needs. */
async function font(weight: 600 | 800, text: string) {
	try {
		const css = await (
			await fetch(
				`https://fonts.googleapis.com/css2?family=Montserrat:wght@${weight}&text=${encodeURIComponent(text)}`,
				{ signal: AbortSignal.timeout(4000) },
			)
		).text();
		const src = css.match(
			/src: url\((.+?)\) format\('(opentype|truetype)'\)/,
		)?.[1];
		if (!src) return null;
		const res = await fetch(src, { signal: AbortSignal.timeout(4000) });
		return res.ok ? await res.arrayBuffer() : null;
	} catch {
		return null;
	}
}

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ slug: string }> },
) {
	const { slug } = await params;
	const share = await getStorefrontShare(slug);
	const name = share?.name ?? "Menu";
	const { accent, onAccent } = brandColors(share?.primaryColor);

	const tags = [
		"Menu & prices",
		"Order online",
		...(share?.bookings ? ["Book a table"] : []),
	];
	const subtitle = share?.address ?? share?.description ?? "";
	const allText = `${name}${subtitle}${tags.join("")}Powered by AwaMenu`;

	const [cover, logo, bold, semibold, dishes] = await Promise.all([
		inline(share?.coverUrl ?? null, "f_jpg,q_80,w_1200,h_630,c_fill,g_auto"),
		inline(share?.logoUrl ?? null, "f_png,w_240,h_240,c_fill"),
		font(800, allText),
		font(600, allText),
		// No cover photo: show the food instead.
		share?.coverUrl
			? Promise.resolve([])
			: Promise.all(
					(share?.dishPhotos ?? []).map((url) =>
						inline(url, "f_jpg,q_80,w_520,h_520,c_fill,g_auto"),
					),
				).then((list) => list.filter((d): d is string => Boolean(d))),
	]);
	// Fanned out on the right, biggest first.
	const fan = [
		{ size: 270, right: 64, top: 64, rotate: 5 },
		{ size: 210, right: 232, top: 318, rotate: -7 },
		{ size: 196, right: 44, top: 356, rotate: 3 },
	];
	const textWidth = dishes.length ? 640 : 900;
	const fonts = [
		...(bold
			? [
					{
						name: "Montserrat",
						data: bold,
						weight: 800 as const,
						style: "normal" as const,
					},
				]
			: []),
		...(semibold
			? [
					{
						name: "Montserrat",
						data: semibold,
						weight: 600 as const,
						style: "normal" as const,
					},
				]
			: []),
	];
	const nameSize = name.length > 28 ? 56 : name.length > 16 ? 68 : 84;

	const png = new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				position: "relative",
				backgroundColor: "#0f172a",
				fontFamily: fonts.length ? "Montserrat" : undefined,
			}}
		>
			{cover ? (
				// biome-ignore lint/performance/noImgElement: rendered to PNG, not a web page
				<img
					src={cover}
					alt=""
					width={1200}
					height={630}
					style={{ position: "absolute", inset: 0, objectFit: "cover" }}
				/>
			) : null}
			<div
				style={{
					position: "absolute",
					inset: 0,
					display: "flex",
					background: cover
						? "linear-gradient(90deg, rgba(15,23,42,0.94) 0%, rgba(15,23,42,0.78) 50%, rgba(15,23,42,0.25) 100%)"
						: `radial-gradient(circle at 82% 38%, ${rgba(accent, 0.5)} 0%, ${rgba(accent, 0.12)} 38%, rgba(15,23,42,0) 62%)`,
				}}
			/>
			{dishes.map((src, i) => (
				// biome-ignore lint/performance/noImgElement: rendered to PNG, not a web page
				<img
					key={src.slice(-24)}
					src={src}
					alt=""
					width={fan[i].size}
					height={fan[i].size}
					style={{
						position: "absolute",
						right: fan[i].right,
						top: fan[i].top,
						borderRadius: 32,
						border: "6px solid rgba(255,255,255,0.95)",
						transform: `rotate(${fan[i].rotate}deg)`,
						boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
					}}
				/>
			))}
			<div
				style={{
					position: "absolute",
					left: 0,
					top: 0,
					bottom: 0,
					width: 14,
					display: "flex",
					backgroundColor: accent,
				}}
			/>

			<div
				style={{
					position: "relative",
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					padding: "0 84px",
					width: "100%",
					height: "100%",
				}}
			>
				{logo ? (
					// biome-ignore lint/performance/noImgElement: rendered to PNG, not a web page
					<img
						src={logo}
						alt=""
						width={128}
						height={128}
						style={{
							borderRadius: 30,
							border: "5px solid rgba(255,255,255,0.95)",
							backgroundColor: "#ffffff",
						}}
					/>
				) : (
					<div
						style={{
							width: 128,
							height: 128,
							borderRadius: 30,
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							backgroundColor: accent,
							color: onAccent,
							fontSize: 64,
							fontWeight: 800,
						}}
					>
						{name.trim().charAt(0).toUpperCase()}
					</div>
				)}

				<div
					style={{
						display: "flex",
						marginTop: 36,
						maxWidth: textWidth,
						color: "#ffffff",
						fontSize: nameSize,
						fontWeight: 800,
						lineHeight: 1.05,
						letterSpacing: -1.5,
					}}
				>
					{name}
				</div>
				{subtitle ? (
					<div
						style={{
							display: "flex",
							marginTop: 18,
							maxWidth: textWidth - 60,
							color: "rgba(255,255,255,0.82)",
							fontSize: 30,
							fontWeight: 600,
							lineHeight: 1.3,
						}}
					>
						{subtitle.length > 90
							? `${subtitle.slice(0, 88).trimEnd()}…`
							: subtitle}
					</div>
				) : null}

				<div style={{ display: "flex", gap: 14, marginTop: 40 }}>
					{tags.map((tag) => (
						<div
							key={tag}
							style={{
								display: "flex",
								padding: dishes.length ? "10px 18px" : "12px 22px",
								borderRadius: 999,
								backgroundColor: "rgba(255,255,255,0.12)",
								border: "2px solid rgba(255,255,255,0.28)",
								color: "#ffffff",
								fontSize: dishes.length ? 22 : 24,
								fontWeight: 600,
							}}
						>
							{tag}
						</div>
					))}
				</div>
			</div>

			{share && !share.branded ? (
				<div
					style={{
						position: "absolute",
						left: 84,
						bottom: 36,
						display: "flex",
						color: "rgba(255,255,255,0.7)",
						fontSize: 22,
						fontWeight: 600,
					}}
				>
					Powered by AwaMenu
				</div>
			) : null}
		</div>,
		{ ...size, fonts: fonts.length ? fonts : undefined },
	);

	// The current version's URL never changes content, so it's cached for
	// good. A stale or missing version (an old link) is kept only briefly.
	const current =
		share !== null &&
		new URL(request.url).searchParams.get("v") === share.imageVersion;
	const headers = {
		"Cache-Control": current
			? "public, max-age=31536000, immutable"
			: "public, max-age=60, s-maxage=60",
	};
	try {
		// Pure JavaScript, so it behaves the same on every host. (sharp can't
		// load inside Next's server bundle on Windows; this can't fail that way.)
		const decoded = PNG.sync.read(Buffer.from(await png.clone().arrayBuffer()));
		const jpeg = jpegJs.encode(
			{ data: decoded.data, width: decoded.width, height: decoded.height },
			82,
		);
		return new Response(new Uint8Array(jpeg.data), {
			headers: { ...headers, "Content-Type": "image/jpeg" },
		});
	} catch (error) {
		// Never lose the preview over a conversion problem: serve the PNG,
		// and say why (header) so it can be diagnosed.
		Sentry.captureException(error, { tags: { component: "og-image" } });
		return new Response(png.body, {
			headers: {
				...headers,
				"Content-Type": "image/png",
				"X-OG-Fallback": String(error)
					.replace(/[^\x20-\x7e]/g, "")
					.slice(0, 160),
			},
		});
	}
}
