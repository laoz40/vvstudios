import {
	contactEmail,
	contactPhone,
} from "./contact";
import type { BusinessSchemaConfig } from "../lib/seo/schema";

export const structuredDataBusiness: BusinessSchemaConfig = {
	name: "VV Podcast Studio",
	url: "https://vertigovisuals.com.au/",
	image: "https://vertigovisuals.com.au/android-chrome-512x512.png",
	telephone: contactPhone,
	email: contactEmail,
	address: {
		"@type": "PostalAddress",
		streetAddress: "23 Fields Rd",
		addressLocality: "Macquarie Fields",
		addressRegion: "NSW",
		postalCode: "2564",
		addressCountry: "AU",
	},
	areaServed: [
		"Macquarie Fields",
		"South West Sydney",
		"Western Sydney",
		"Sydney",
	],
	parentOrganization: {
		"@type": "Organization",
		name: "Vertigo Visuals",
		"@id": "https://vertigovisuals.com.au/#organization",
	},
};
