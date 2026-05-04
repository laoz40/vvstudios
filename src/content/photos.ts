import armchairSetupImage from "#/assets/gallery/armchair-setup.webp";
import armchairVerticalImage from "#/assets/gallery/armchair-vertical.webp";
import behindTheScenesWideImage from "#/assets/gallery/behind-the-scenes-wide.webp";
import behindTheScenesImage from "#/assets/gallery/behind-the-scenes.webp";
import expressiveManImage from "#/assets/gallery/expressive-man.webp";
import girlNotSadImage from "#/assets/gallery/girl-not-sad.webp";
import girlSingingImage from "#/assets/gallery/girl-singing.webp";
import leonardoDicaprioImage from "#/assets/gallery/leonardo-dicaprio.webp";
import micSetupImage from "#/assets/gallery/mic-setup.webp";
import screenImage from "#/assets/gallery/screen.webp";
import tableSetupImage from "#/assets/gallery/table-setup.webp";
import trioTalkingAtTableSetupImage from "#/assets/gallery/trio-talking-at-table-setup.webp";

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
	tourDialogDescription: string;
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
	tourDialogDescription: "See the studio space before you book.",
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
			width: 2560,
			height: 1375,
		},
		{
			src: micSetupImage,
			alt: "VV Podcast Studio gallery image of the equipment and camera setup",
			width: 1280,
			height: 1920,
		},
		{
			src: leonardoDicaprioImage,
			alt: "VV Podcast Studio gallery image of the main recording setup",
			width: 2560,
			height: 1920,
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
			width: 1920,
			height: 1081,
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
