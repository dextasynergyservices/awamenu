"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect } from "react";

gsap.registerPlugin(ScrollTrigger);

/**
 * Renders nothing — mounts once on the homepage and wires up scroll-triggered
 * reveal animations for the Features and Pricing sections via class markers
 * (`.scroll-anim-heading`, `.scroll-anim-card-group` + `.scroll-anim-card`).
 * Kept as its own client component so the sections it targets can stay
 * server-rendered.
 */
export function ScrollRevealAnimations() {
	useEffect(() => {
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			return;
		}

		const ctx = gsap.context(() => {
			for (const el of gsap.utils.toArray<HTMLElement>(
				".scroll-anim-heading",
			)) {
				gsap.from(el, {
					y: 32,
					opacity: 0,
					duration: 0.7,
					ease: "power3.out",
					scrollTrigger: { trigger: el, start: "top 85%" },
				});
			}

			for (const group of gsap.utils.toArray<HTMLElement>(
				".scroll-anim-card-group",
			)) {
				const cards = group.querySelectorAll(".scroll-anim-card");
				gsap.from(cards, {
					y: 40,
					opacity: 0,
					duration: 0.6,
					ease: "power3.out",
					stagger: 0.12,
					scrollTrigger: { trigger: group, start: "top 85%" },
				});
			}
		});

		return () => ctx.revert();
	}, []);

	return null;
}
