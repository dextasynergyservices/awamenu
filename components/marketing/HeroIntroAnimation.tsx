"use client";

import gsap from "gsap";
import { useEffect } from "react";

// ─── Timing controls — adjust these numbers to change when things appear ───

// Navbar slides in this many seconds after the page mounts.
const NAV_REVEAL_DELAY_SECONDS = 0.9;

// CTA buttons slide in this many seconds after the page mounts.
// Increase this number to make the buttons appear later.
const BUTTON_REVEAL_DELAY_SECONDS = 3.8;
const EYEBROW_REVEAL_DELAY_SECONDS = 2.3;

// The headline text slides in this many seconds BEFORE the background video
// ends (the video plays once, no loop). Increase this number to make the
// text appear EARLIER (further from the video's end); decrease it to make
// the text appear LATER (closer to the video's actual end).
const TEXT_REVEAL_LEAD_SECONDS = 2.7;

// If the video's metadata (duration) never loads — network failure, blocked
// request, etc. — animate the text anyway after this many milliseconds,
// rather than skipping it forever.
const HARD_FALLBACK_MS = 3000;

/**
 * Renders nothing — mounts once on the homepage hero. The nav, headline text,
 * and CTA buttons are always visible by default (no opacity hiding, no
 * failure mode where they can get stuck invisible); this only layers a subtle
 * slide-into-place motion on top via a y-offset, never touching opacity.
 * Nav/CTA buttons animate on fixed short delays. The eyebrow/headline slide
 * time is computed from the background video's own `duration` (read from
 * `loadedmetadata`, which fires regardless of whether autoplay is actually
 * permitted) so it lands `TEXT_REVEAL_LEAD_SECONDS` before the video's real
 * end. Kept as its own client component so the hero itself (data-fetching,
 * MarketingHeader) can stay a server component.
 */
export function HeroIntroAnimation() {
	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return;
		}

		const introCtx = gsap.context(() => {
			// Nav slides straight down from above.
			gsap.fromTo(
				".hero-anim-nav",
				{ y: -32, opacity: 0 },
				{
					y: 0,
					opacity: 1,
					duration: 0.8,
					ease: "power2.out",
					delay: NAV_REVEAL_DELAY_SECONDS,
				},
			);
			// Buttons slide in diagonally from the bottom-right.
			gsap.fromTo(
				".hero-anim-ctas",
				{ x: 40, y: 30, opacity: 0 },
				{
					x: 0,
					y: 0,
					opacity: 1,
					duration: 0.8,
					ease: "power2.out",
					delay: BUTTON_REVEAL_DELAY_SECONDS,
				},
			);

			gsap.fromTo(
				".hero-anim-eyebrow",
				{ x: 40, y: 30, opacity: 0 },
				{
					x: 0,
					y: 0,
					opacity: 1,
					duration: 0.8,
					ease: "power2.out",
					delay: EYEBROW_REVEAL_DELAY_SECONDS,
				},
			);

			gsap.fromTo(
				".hero-anim-title",
				{ x: 40, y: 30, opacity: 0 },
				{
					x: 0,
					y: 0,
					opacity: 1,
					duration: 0.8,
					ease: "power2.out",
					delay: TEXT_REVEAL_LEAD_SECONDS,
				},
			);
		});

		let textRevealed = false;
		let textCtx: gsap.Context | undefined;

		function revealText() {
			if (textRevealed) return;
			textRevealed = true;
			textCtx = gsap.context(() => {
				gsap
					.timeline({ defaults: { ease: "power2.out", duration: 0.8 } })
					// Eyebrow slides in from the left.
					.fromTo(
						".hero-anim-eyebrow",
						{ x: -50, opacity: 0 },
						{ x: 0, opacity: 1 },
					)
					// Headline slides in from the right.
					.fromTo(
						".hero-anim-title",
						{ x: 60, opacity: 0 },
						{ x: 0, opacity: 1 },
						"-=0.5",
					);
			});
		}

		// Two <video> elements exist (mobile-portrait + desktop-landscape
		// sources), toggled purely via CSS breakpoints — pick whichever one is
		// actually rendered for the current viewport.
		const video = Array.from(
			document.querySelectorAll<HTMLVideoElement>(".hero-bg-video"),
		).find((el) => el.offsetParent !== null);

		const hardFallback = window.setTimeout(revealText, HARD_FALLBACK_MS);

		if (!video) {
			return () => {
				window.clearTimeout(hardFallback);
				introCtx.revert();
				textCtx?.revert();
			};
		}

		let textTimer: number | undefined;

		function scheduleFromDuration() {
			if (
				!Number.isFinite(video?.duration) ||
				!video?.duration ||
				video.duration <= 0
			) {
				return;
			}
			window.clearTimeout(hardFallback);
			const remaining = Math.max(
				0,
				video.duration - TEXT_REVEAL_LEAD_SECONDS - video.currentTime,
			);
			textTimer = window.setTimeout(revealText, remaining * 1000);
		}

		if (video.readyState >= 1) {
			// HAVE_METADATA or better — duration is already known.
			scheduleFromDuration();
		} else {
			video.addEventListener("loadedmetadata", scheduleFromDuration, {
				once: true,
			});
		}
		// Belt-and-suspenders: if the video actually finishes playing before
		// our computed timer fires for any reason, animate immediately.
		video.addEventListener("ended", revealText);

		return () => {
			video.removeEventListener("loadedmetadata", scheduleFromDuration);
			video.removeEventListener("ended", revealText);
			window.clearTimeout(hardFallback);
			window.clearTimeout(textTimer);
			introCtx.revert();
			textCtx?.revert();
		};
	}, []);

	return null;
}
