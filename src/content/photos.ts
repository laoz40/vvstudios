import armchairSetupImage from "#/assets/gallery/armchair-setup.jpg";
import armchairVerticalImage from "#/assets/gallery/armchair-vertical.jpg";
import behindTheScenesWideImage from "#/assets/gallery/behind-the-scenes-wide.jpg";
import behindTheScenesImage from "#/assets/gallery/behind-the-scenes.jpg";
import expressiveManImage from "#/assets/gallery/expressive-man.jpg";
import girlNotSadImage from "#/assets/gallery/girl-not-sad.jpg";
import girlSingingImage from "#/assets/gallery/girl-singing.jpg";
import leonardoDicaprioImage from "#/assets/gallery/leonardo-dicaprio.jpg";
import micSetupImage from "#/assets/gallery/mic-setup.jpg";
import screenImage from "#/assets/gallery/screen.jpg";
import tableSetupImage from "#/assets/gallery/table-setup.jpg";
import trioTalkingAtTableSetupImage from "#/assets/gallery/trio-talking-at-table-setup.jpg";

export interface PhotoGalleryImage {
	src: string;
	alt: string;
	width: number;
	height: number;
}

export interface PhotosPageContent {
	title: string;
	introText: string;
	bookCta: string;
	tourCta: string;
	tourDialogLabel: string;
	tourDialogCloseLabel: string;
	tourIframeTitle: string;
	galleryImages: PhotoGalleryImage[];
}

export const photosPageContent: PhotosPageContent = {
	title: "A quick look at the space",
	introText:
		"These photos give you a proper look at the studio before you book. You can see the sets, the lighting, and the overall feel of the space, so you know what to expect when you walk in.",
	bookCta: "Book session",
	tourCta: "Take free tour",
	tourDialogLabel: "Take a free tour",
	tourDialogCloseLabel: "Close",
	tourIframeTitle: "Free studio tour booking",
	galleryImages: [
		{
			src: armchairSetupImage,
			alt: "VV Podcast Studio gallery image showing the armchair setup",
			width: 1885,
			height: 1060,
		},
		{
			src: expressiveManImage,
			alt: "VV Podcast Studio gallery image of the studio lighting and desk area",
			width: 4000,
			height: 2149,
		},
		{
			src: micSetupImage,
			alt: "VV Podcast Studio gallery image of the equipment and camera setup",
			width: 4000,
			height: 6000,
		},
		{
			src: leonardoDicaprioImage,
			alt: "VV Podcast Studio gallery image of the main recording setup",
			width: 3313,
			height: 2485,
		},
		{
			src: behindTheScenesWideImage,
			alt: "VV Podcast Studio gallery image showing the studio from the entry side",
			width: 1971,
			height: 1110,
		},
		{
			src: girlNotSadImage,
			alt: "VV Podcast Studio gallery image of a guest recording in the studio",
			width: 1060,
			height: 1885,
		},
		{
			src: behindTheScenesImage,
			alt: "VV Podcast Studio gallery image showing the studio from the entry side",
			width: 1305,
			height: 2178,
		},
		{
			src: tableSetupImage,
			alt: "VV Podcast Studio gallery image of a seated recording area",
			width: 1885,
			height: 1060,
		},
		{
			src: trioTalkingAtTableSetupImage,
			alt: "VV Podcast Studio gallery image showing the table setup",
			width: 1612,
			height: 1612,
		},
		{
			src: screenImage,
			alt: "VV Podcast Studio gallery image showing the screen setup",
			width: 2595,
			height: 1461,
		},
		{
			src: armchairVerticalImage,
			alt: "VV Podcast Studio gallery image showing the armchair setup",
			width: 1060,
			height: 1885,
		},
		{
			src: girlSingingImage,
			alt: "VV Podcast Studio gallery image of a guest singing in the studio",
			width: 1788,
			height: 1117,
		},
	],
};
