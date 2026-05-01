type SeoMetadata = {
	title: string;
	description: string;
	path: string;
	ogImage: string;
};

export const seoMetadata = {
	home: {
		title: "Podcast Studio Hire in South West Sydney | VV Podcast Studio",
		description:
			"Hire a professional podcast studio in South West Sydney. VV Podcast Studio helps business owners, creators, and entrepreneurs record polished podcast and video content in Sydney.",
		path: "/",
		ogImage: "/android-chrome-512x512.png",
	},
	book: {
		title: "Book a Podcast Studio Session | VV Podcast Studio",
		description:
			"Book your podcast studio session in Sydney. Choose your recording space, session time, and select any add-ons to enhance your production.",
		path: "/book",
		ogImage: "/android-chrome-512x512.png",
	},
	contact: {
		title: "Contact VV Podcast Studio | VV Podcast Studio",
		description:
			"Contact VV Podcast Studio to plan your next podcast or video session. Reach out for studio details, bookings, and production support in Sydney.",
		path: "/contact",
		ogImage: "/android-chrome-512x512.png",
	},
	gallery: {
		title: "Podcast Studio Photos | VV Podcast Studio",
		description:
			"Browse photos of VV Podcast Studio and see the podcast sets, lighting, cameras, and recording environment available for business owners and creators in South West Sydney.",
		path: "/gallery",
		ogImage: "/android-chrome-512x512.png",
	},
	pricing: {
		title: "Podcast Studio Pricing | VV Podcast Studio",
		description:
			"View VV Podcast Studio pricing for 1, 2, and 3 hour podcast and video sessions, plus optional add-ons including 4K recording, editing, and social clips.",
		path: "/pricing",
		ogImage: "/android-chrome-512x512.png",
	},
} as const satisfies Record<string, SeoMetadata>;

export function buildSeoHead(metadata: SeoMetadata) {
	return {
		meta: [
			{ title: metadata.title },
			{ name: "description", content: metadata.description },
			{ property: "og:type", content: "website" },
			{ property: "og:title", content: metadata.title },
			{ property: "og:description", content: metadata.description },
			{ property: "og:url", content: metadata.path },
			{ property: "og:image", content: metadata.ogImage },
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: metadata.title },
			{ name: "twitter:description", content: metadata.description },
			{ name: "twitter:image", content: metadata.ogImage },
		],
		links: [{ rel: "canonical", href: metadata.path }],
	};
}
