"use client";

import { useState } from "react";
import { env } from "@/env";
import { slugify } from "@/lib/slug";

const inputClassName =
	"h-11 border border-zinc-300 px-3 text-base outline-none focus:border-emerald-700 focus:ring-2 focus:ring-yellow-300/60";

/**
 * Restaurant name + web-address (slug) pair for the onboarding setup form.
 * The slug auto-fills from the name as the owner types — most restaurant
 * owners have never heard the word "slug" and shouldn't need to. It stops
 * auto-following the name the moment they type into the slug field
 * themselves, so a deliberate edit is never silently overwritten.
 */
export function RestaurantNameSlugFields() {
	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [slugTouched, setSlugTouched] = useState(false);

	const previewHost = (
		env.NEXT_PUBLIC_APP_URL ?? "https://awamenu.com"
	).replace(/^https?:\/\//, "");

	return (
		<>
			<label className="grid gap-2 text-sm font-medium text-zinc-800">
				Restaurant name
				<input
					name="name"
					required
					value={name}
					onChange={(event) => {
						const value = event.currentTarget.value;
						setName(value);
						if (!slugTouched) setSlug(slugify(value));
					}}
					className={inputClassName}
				/>
			</label>
			<label className="grid gap-2 text-sm font-medium text-zinc-800">
				Web address
				<input
					name="slug"
					required
					pattern="[a-z0-9]+(-[a-z0-9]+)*"
					value={slug}
					onChange={(event) => {
						setSlugTouched(true);
						setSlug(slugify(event.currentTarget.value));
					}}
					className={inputClassName}
				/>
				<span className="text-xs font-normal leading-relaxed text-zinc-500">
					This is the web address customers use to view your menu, e.g.{" "}
					<span className="font-semibold text-emerald-700">
						{previewHost}/{slug || "your-restaurant"}
					</span>
					. We filled it in from your restaurant name — change it if you'd like
					something different.
				</span>
			</label>
		</>
	);
}
