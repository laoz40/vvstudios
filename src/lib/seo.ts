import { studioSite } from "#/config/sites";
import { env } from "#/env";

const siteUrl = "https://vertigovisuals.com.au";
const siteName = studioSite.name;
const defaultOgImage = "/icons/studio/android-chrome-512x512.png";

type SeoMetadata = {
	title: string;
	description: string;
	path: string;
	ogImage?: string;
};

export const seoMetadata = {
	home: {
		title: "Podcast Studio Hire Sydney | VV Studios",
		description:
			"Podcast studio hire in Sydney for creators, businesses and entrepreneurs. Record polished video podcasts at VV Studios in South West Sydney. Book a session today.",
		path: studioSite.routes.home,
	},
	book: {
		title: "Book a Podcast Studio Session | VV Studios",
		description:
			"Book your podcast studio session in Sydney. Choose your recording space, session time, and select any add-ons to enhance your production.",
		path: studioSite.routes.book,
	},
	contact: {
		title: "Contact VV Studios | VV Studios",
		description:
			"Contact VV Studios to plan your next podcast or video session. Reach out for studio details, bookings, and production support in Sydney.",
		path: studioSite.routes.contact,
	},
	gallery: {
		title: "Podcast Studio Photos | VV Studios",
		description:
			"Browse photos of VV Studios and see the podcast sets, lighting, cameras, and recording environment available for business owners and creators in South West Sydney.",
		path: studioSite.routes.gallery,
	},
	pricing: {
		title: "Podcast Studio Pricing | VV Studios",
		description:
			"View VV Studios pricing for 1, 2, and 3 hour podcast and video sessions, plus optional add-ons including 4K recording, editing, and social clips.",
		path: studioSite.routes.pricing,
	},
	privacyPolicy: {
		title: "Privacy Policy | VV Studios",
		description:
			"Read the VV Studios privacy policy to learn how booking, payment, website and contact information is collected and used.",
		path: studioSite.routes.privacyPolicy,
	},
} as const satisfies Record<string, SeoMetadata>;

export function buildAbsoluteUrl(path: string) {
	return new URL(path, siteUrl).toString();
}

export function buildSeoHead(metadata: SeoMetadata) {
	const canonicalUrl = buildAbsoluteUrl(metadata.path);
	const imageUrl = buildAbsoluteUrl(metadata.ogImage ?? defaultOgImage);

	return {
		meta: [
			{ title: metadata.title },
			{ name: "description", content: metadata.description },
			{ property: "og:site_name", content: siteName },
			{ property: "og:type", content: "website" },
			{ property: "og:title", content: metadata.title },
			{ property: "og:description", content: metadata.description },
			{ property: "og:url", content: canonicalUrl },
			{ property: "og:image", content: imageUrl },
			{ name: "twitter:card", content: "summary_large_image" },
			{ name: "twitter:title", content: metadata.title },
			{ name: "twitter:description", content: metadata.description },
			{ name: "twitter:image", content: imageUrl },
		],
		links: [{ rel: "canonical", href: canonicalUrl }],
	};
}

export function buildNoIndexHead(title: string) {
	return {
		meta: [{ title }, { name: "robots", content: "noindex, nofollow" }],
	};
}

type FaqJsonLdItem = {
	answer: string;
	question: string;
};

export function buildFaqPageJsonLd(items: readonly FaqJsonLdItem[]) {
	return {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		mainEntity: items.map((item) => ({
			"@type": "Question",
			name: item.question,
			acceptedAnswer: {
				"@type": "Answer",
				text: item.answer,
			},
		})),
	};
}

export function buildWebSiteJsonLd() {
	return {
		"@context": "https://schema.org",
		"@type": "WebSite",
		name: siteName,
		alternateName: "Vertigo Visuals",
		url: `${siteUrl}/`,
	};
}

export function buildLocalBusinessJsonLd() {
	return {
		"@context": "https://schema.org",
		"@type": "LocalBusiness",
		name: siteName,
		description: seoMetadata.home.description,
		url: siteUrl,
		image: buildAbsoluteUrl(defaultOgImage),
		telephone: "+61434367184",
		email: "contact@vertigovisuals.com.au",
		priceRange: "$200/1h, $299/2h, $399/3h",
		areaServed: "South West Sydney, NSW, Australia",
		address: {
			"@type": "PostalAddress",
			streetAddress: "23 Fields Rd",
			addressLocality: "Macquarie Fields",
			addressRegion: "NSW",
			postalCode: "2564",
			addressCountry: "AU",
		},
		openingHoursSpecification: [
			{
				"@type": "OpeningHoursSpecification",
				dayOfWeek: "Sunday",
				opens: "10:00",
				closes: "21:00",
			},
			{
				"@type": "OpeningHoursSpecification",
				dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
				opens: "08:00",
				closes: "22:00",
			},
			{
				"@type": "OpeningHoursSpecification",
				dayOfWeek: "Saturday",
				opens: "08:00",
				closes: "21:00",
			},
		],
		sameAs: [siteUrl, env.VITE_APP_INSTAGRAM_URL],
		offers: [
			{
				"@type": "Offer",
				name: "1 hour podcast studio session",
				price: "200",
				priceCurrency: "AUD",
			},
			{
				"@type": "Offer",
				name: "2 hour podcast studio session",
				price: "299",
				priceCurrency: "AUD",
			},
			{
				"@type": "Offer",
				name: "3 hour podcast studio session",
				price: "399",
				priceCurrency: "AUD",
			},
			{
				"@type": "Offer",
				name: "4K recording add-on",
				price: "49",
				priceCurrency: "AUD",
			},
			{
				"@type": "Offer",
				name: "Video editing add-on",
				price: "99",
				priceCurrency: "AUD",
			},
			{
				"@type": "Offer",
				name: "Edited social media clips add-on",
				price: "79",
				priceCurrency: "AUD",
			},
		],
	};
}
