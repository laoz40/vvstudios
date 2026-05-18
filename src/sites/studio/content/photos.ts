import armchairSetupImage from "#studio/assets/gallery/armchair-setup.webp";
import armchairVerticalImage from "#studio/assets/gallery/armchair-vertical.webp";
import behindTheScenesWideImage from "#studio/assets/gallery/behind-the-scenes-wide.webp";
import behindTheScenesImage from "#studio/assets/gallery/behind-the-scenes.webp";
import expressiveManImage from "#studio/assets/gallery/expressive-man.webp";
import girlNotSadImage from "#studio/assets/gallery/girl-not-sad.webp";
import girlSingingImage from "#studio/assets/gallery/girl-singing.webp";
import leonardoDicaprioImage from "#studio/assets/gallery/leonardo-dicaprio.webp";
import micSetupImage from "#studio/assets/gallery/mic-setup.webp";
import musicSetupImage from "#studio/assets/gallery/music-setup.webp";
import screenImage from "#studio/assets/gallery/screen.webp";
import tableSetupImage from "#studio/assets/gallery/table-setup.webp";
import trioTalkingAtTableSetupImage from "#studio/assets/gallery/trio-talking-at-table-setup.webp";

export interface PhotoGalleryImage {
	src: string;
	alt: string;
	width: number;
	height: number;
}

export interface PhotosPageContent {
	title: string;
	bookCta: string;
	tourCta: string;
	tourDialogLabel: string;
	tourDialogDescription: string;
	tourDialogCloseLabel: string;
	tourIframeTitle: string;
	galleryImages: PhotoGalleryImage[];
}

const galleryImages: PhotoGalleryImage[] = [
	{
		src: armchairSetupImage,
		alt: "Podcast studio hire Sydney armchair setup at VV Studios",
		width: 1885,
		height: 1060,
	},
	{
		src: expressiveManImage,
		alt: "Sydney podcast studio lighting and desk setup for video recording",
		width: 2560,
		height: 1375,
	},
	{
		src: micSetupImage,
		alt: "Podcast studio equipment with cameras, microphones and lighting in Sydney",
		width: 1280,
		height: 1920,
	},
	{
		src: leonardoDicaprioImage,
		alt: "Main podcast recording setup at VV Studios in South West Sydney",
		width: 2560,
		height: 1920,
	},
	{
		src: behindTheScenesWideImage,
		alt: "Behind the scenes view of VV Studios podcast studio hire space in Sydney",
		width: 1971,
		height: 1110,
	},
	{
		src: girlNotSadImage,
		alt: "Guest recording a video podcast at VV Studios in Sydney",
		width: 1060,
		height: 1885,
	},
	{
		src: behindTheScenesImage,
		alt: "Entry side view of the VV Studios podcast recording space in Sydney",
		width: 1305,
		height: 2178,
	},
	{
		src: tableSetupImage,
		alt: "Podcast studio table setup for hire at VV Studios Sydney",
		width: 1885,
		height: 1060,
	},
	{
		src: trioTalkingAtTableSetupImage,
		alt: "Three person podcast recording table setup at VV Studios Sydney",
		width: 1612,
		height: 1612,
	},
	{
		src: screenImage,
		alt: "Sydney podcast studio screen setup for branded video podcast recording",
		width: 1920,
		height: 1081,
	},
	{
		src: armchairVerticalImage,
		alt: "Armchair video podcast setup at VV Studios in South West Sydney",
		width: 1060,
		height: 1885,
	},
	{
		src: girlSingingImage,
		alt: "Creator recording audio and video content at VV Studios Sydney",
		width: 1788,
		height: 1117,
	},
];

export const landingMobileGalleryImages: PhotoGalleryImage[] = [
	{
		src: tableSetupImage,
		alt: "Podcast studio table setup for hire at VV Studios Sydney",
		width: 1885,
		height: 1060,
	},
	{
		src: armchairSetupImage,
		alt: "Podcast studio hire Sydney armchair setup at VV Studios",
		width: 1885,
		height: 1060,
	},
	{
		src: musicSetupImage,
		alt: "Music production setup inside VV Studios podcast studio in Sydney",
		width: 1920,
		height: 1080,
	},
	{
		src: trioTalkingAtTableSetupImage,
		alt: "Three person podcast recording table setup at VV Studios Sydney",
		width: 1612,
		height: 1612,
	},
	{
		src: screenImage,
		alt: "Sydney podcast studio screen setup for branded video podcast recording",
		width: 1920,
		height: 1081,
	},
	// {
	// 	src: armchairVerticalImage,
	// 	alt: "Armchair video podcast setup at VV Studios in South West Sydney",
	// 	width: 1060,
	// 	height: 1885,
	// },
	{
		src: girlSingingImage,
		alt: "Creator recording audio and video content at VV Studios Sydney",
		width: 1788,
		height: 1117,
	},
];

export const photosPageContent: PhotosPageContent = {
	title: "What to expect at VV Studios",
	bookCta: "Book session",
	tourCta: "Take free tour",
	tourDialogLabel: "Take a free tour",
	tourDialogDescription: "See the studio space before you book.",
	tourDialogCloseLabel: "Close",
	tourIframeTitle: "Free studio tour booking",
	galleryImages,
};
