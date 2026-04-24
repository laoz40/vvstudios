export type PhotoGalleryImage = {
	filename: string;
	alt: string;
};

export type PhotosPageContent = {
	title: string;
	introText: string;
	homeGalleryImages: PhotoGalleryImage[];
	galleryImages: PhotoGalleryImage[];
};

export const photosPageContent: PhotosPageContent = {
	title: "A quick look at the space",
	introText:
		"These photos give you a proper look at the studio before you book. You can see the sets, the lighting, and the overall feel of the space, so you know what to expect when you walk in.",
	homeGalleryImages: [
		{
			filename: "armchair-setup.jpg",
			alt: "VV Podcast Studio gallery image showing the armchair setup",
		},
		{
			filename: "expressive-man.jpg",
			alt: "VV Podcast Studio gallery image of the studio lighting and desk area",
		},
		{
			filename: "mic-setup.jpg",
			alt: "VV Podcast Studio gallery image of the equipment and camera setup",
		},
		{
			filename: "leonardo-dicaprio.jpg",
			alt: "VV Podcast Studio gallery image of the main recording setup",
		},
		{
			filename: "behind-the-scenes-wide.jpg",
			alt: "VV Podcast Studio gallery image showing the studio from the entry side",
		},

		{
			filename: "girl-not-sad.jpg",
			alt: "VV Podcast Studio gallery image of a guest recording in the studio",
		},
		{
			filename: "behind-the-scenes.jpg",
			alt: "VV Podcast Studio gallery image showing the studio from the entry side",
		},
		{
			filename: "table-setup.jpg",
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
			filename: "girl-singing.jpg",
			alt: "VV Podcast Studio gallery image of a guest singing in the studio",
		},
	],
	galleryImages: [
		{
			filename: "armchair-setup.jpg",
			alt: "VV Podcast Studio gallery image showing the armchair setup",
		},
		{
			filename: "expressive-man.jpg",
			alt: "VV Podcast Studio gallery image of the studio lighting and desk area",
		},
		{
			filename: "mic-setup.jpg",
			alt: "VV Podcast Studio gallery image of the equipment and camera setup",
		},
		{
			filename: "leonardo-dicaprio.jpg",
			alt: "VV Podcast Studio gallery image of the main recording setup",
		},
		{
			filename: "behind-the-scenes-wide.jpg",
			alt: "VV Podcast Studio gallery image showing the studio from the entry side",
		},

		{
			filename: "girl-not-sad.jpg",
			alt: "VV Podcast Studio gallery image of a guest recording in the studio",
		},
		{
			filename: "behind-the-scenes.jpg",
			alt: "VV Podcast Studio gallery image showing the studio from the entry side",
		},
		{
			filename: "table-setup.jpg",
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
			filename: "girl-singing.jpg",
			alt: "VV Podcast Studio gallery image of a guest singing in the studio",
		},
	],
};
