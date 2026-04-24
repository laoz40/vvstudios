export type PhotosPageContent = {
	title: string;
	introText: string;
	galleryImages: {
		filename: string;
		alt: string;
	}[];
};

export const photosPageContent: PhotosPageContent = {
	title: "A quick look at the space",
	introText:
		"These photos give you a proper look at the studio before you book. You can see the sets, the lighting, and the overall feel of the space, so you know what to expect when you walk in.",
	galleryImages: [
		{
			filename: "behind-the-scenes-wide.jpg",
			alt: "VV Podcast Studio gallery image showing the main set with lighting",
		},
		{
			filename: "man-and-woman-talking.jpg",
			alt: "VV Podcast Studio gallery image of the lounge seating area",
		},
		{
			filename: "armchair-setup.jpg",
			alt: "VV Podcast Studio gallery image showing the armchair setup",
		},

		{
			filename: "armchair-close.jpg",
			alt: "VV Podcast Studio gallery image showing the armchair setup",
		},
		{
			filename: "leonardo-dicaprio.jpg",
			alt: "VV Podcast Studio gallery image of the main recording setup",
		},
		{
			filename: "behind-the-scenes.jpg",
			alt: "VV Podcast Studio gallery image showing the studio from the entry side",
		},

		{
			filename: "mic-setup.jpg",
			alt: "VV Podcast Studio gallery image of the equipment and camera setup",
		},
		{
			filename: "table-setup.webp",
			alt: "VV Podcast Studio gallery image of a seated recording area",
		},
		{
			filename: "trio-talking-at-table-setup.jpg",
			alt: "VV Podcast Studio gallery image showing the table setup",
		},

		{
			filename: "screen.jpg",
			alt: "VV Podcast Studio gallery image showing the screen setup",
		},
		{
			filename: "armchair-vertical.jpg",
			alt: "VV Podcast Studio gallery image showing the armchair setup",
		},
		{
			filename: "expressive-man.jpg",
			alt: "VV Podcast Studio gallery image of the studio lighting and desk area",
		},
	],
};
