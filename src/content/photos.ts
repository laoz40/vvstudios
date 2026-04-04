export type PhotosPageContent = {
	title: string;
	introText: string;
	closingText: string;
	galleryImages: {
		filename: string;
		alt: string;
	}[];
};

export const photosPageContent: PhotosPageContent = {
	title: "A quick look at the space",
	introText:
		"These photos give you a proper look at the studio before you book. You can see the sets, the lighting, and the overall feel of the space, so you know what to expect when you walk in.",
	closingText:
		"Like what you see? Book a session or take a free tour. The space is set up for podcasts, interviews, and branded content, with a clean, professional look on camera.",
	galleryImages: [
		{
			filename: "leonardo-dicaprio.jpg",
			alt: "VV Podcast Studio gallery image of the main recording setup",
		},
		{
			filename: "table-setup.webp",
			alt: "VV Podcast Studio gallery image of a seated recording area",
		},
		{
			filename: "expressive-man.jpg",
			alt: "VV Podcast Studio gallery image of the studio lighting and desk area",
		},
		{
			filename: "man-and-woman-talking.jpg",
			alt: "VV Podcast Studio gallery image of the lounge seating area",
		},
		{
			filename: "mic-setup.jpg",
			alt: "VV Podcast Studio gallery image of the equipment and camera setup",
		},
		{
			filename: "behind-the-scenes.jpg",
			alt: "VV Podcast Studio gallery image showing the studio from the entry side",
		},
		{
			filename: "behind-the-scenes-wide.jpg",
			alt: "VV Podcast Studio gallery image showing the main set with lighting",
		},
		{
			filename: "screen.jpg",
			alt: "VV Podcast Studio gallery image showing the couch setup",
		},
		{
			filename: "trio-talking-at-table-setup.jpg",
			alt: "VV Podcast Studio gallery image showing the table setup",
		},
	],
};
