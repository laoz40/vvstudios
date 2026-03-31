export type PhotosPageContent = {
	title: string;
	galleryImages: {
		filename: string;
		alt: string;
	}[];
};

export const photosPageContent: PhotosPageContent = {
	title: "A quick look at the space",
	galleryImages: [
		{
			filename: "leonardo-dicaprio.jpg",
			alt: "VV Podcast Studio gallery image of the main recording setup",
		},
		{
			filename: "table-setup.jpg",
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
