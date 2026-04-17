export type SeoPageKey =
	| "home"
	| "book"
	| "finaliseBooking"
	| "contact"
	| "photos";

export type SeoPageEntry = {
	title: string;
	description: string;
	path: string;
	ogImage: string;
};

export const brandName = "VV Podcast Studio";

export const seoPages: Record<SeoPageKey, SeoPageEntry> = {
	home: {
		title: "Podcast Studio Hire in South West Sydney | VV Podcast Studio",
		description:
			"Hire a professional podcast studio in South West Sydney. VV Podcast Studio helps business owners, creators, and entrepreneurs record polished podcast and video content in Macquarie Fields.",
		path: "/",
		ogImage: "/android-chrome-512x512.png",
	},
	book: {
		title: "Book a Podcast Studio Session | VV Podcast Studio",
		description:
			"Book your podcast studio session in Macquarie Fields. Choose your recording space and session time before moving to the final booking details.",
		path: "/book",
		ogImage: "/android-chrome-512x512.png",
	},
	finaliseBooking: {
		title: "Finalise Your Podcast Studio Booking | VV Podcast Studio",
		description:
			"Finalise your VV Podcast Studio booking with session details, add-ons, and billing information before submission.",
		path: "/finalise-booking",
		ogImage: "/android-chrome-512x512.png",
	},
	contact: {
		title: "Contact VV Podcast Studio | VV Podcast Studio",
		description:
			"Contact VV Podcast Studio to plan your next podcast or video session. Reach out for studio details, bookings, and production support in South West Sydney.",
		path: "/contact",
		ogImage: "/android-chrome-512x512.png",
	},
	photos: {
		title: "Podcast Studio Photos | VV Podcast Studio",
		description:
			"Browse photos of VV Podcast Studio in Macquarie Fields and see the podcast sets, lighting, cameras, and recording environment available for business owners and creators in South West Sydney.",
		path: "/photos",
		ogImage: "/android-chrome-512x512.png",
	},
};
