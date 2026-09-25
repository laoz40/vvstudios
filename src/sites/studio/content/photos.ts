import armchairSetupImage from "#studio/assets/gallery/armchair-setup.webp";
import armchairVerticalImage from "#studio/assets/gallery/armchair-vertical.webp";
import behindTheScenesWideImage from "#studio/assets/gallery/behind-the-scenes-wide.webp";
import behindTheScenesImage from "#studio/assets/gallery/behind-the-scenes.webp";
import expressiveManImage from "#studio/assets/gallery/expressive-man.webp";
import girlNotSadImage from "#studio/assets/gallery/girl-not-sad.webp";
import girlSingingImage from "#studio/assets/gallery/girl-singing.webp";
import leonardoDicaprioImage from "#studio/assets/gallery/leonardo-dicaprio.webp";
import manAndWomanImage from "#studio/assets/gallery/man-and-woman.webp";
import micSetupImage from "#studio/assets/gallery/mic-setup.webp";
import musicSetupImage from "#studio/assets/gallery/music-setup.webp";
import screenImage from "#studio/assets/gallery/screen.webp";
import tableSetupImage from "#studio/assets/gallery/table-setup.webp";
import timelineImage from "#studio/assets/gallery/timeline.webp";
import trioTalkingAtTableSetupImage from "#studio/assets/gallery/trio-talking-at-table-setup.webp";
import micImage from "#studio/assets/mic.webp";

export interface PhotoGalleryImage {
	src: string;
	alt: string;
	width: number;
	height: number;
	caption?: string;
}

export interface PhotosPageContent {
	title: string;
	lead: string;
	bookCta: string;
	tourCta: string;
	tourDialogLabel: string;
	tourDialogDescription: string;
	tourDialogCloseLabel: string;
	tourIframeTitle: string;
	galleryImages: PhotoGalleryImage[];
}

export const armchairSetupPhoto: PhotoGalleryImage = {
	src: armchairSetupImage,
	alt: "Two white armchairs with boom microphones, wood slat wall, and greenery",
	width: 1885,
	height: 1060
};

export const expressiveManPhoto: PhotoGalleryImage = {
	src: expressiveManImage,
	alt: "Host gesturing while recording at a desk with a camera and broadcast microphone",
	width: 2560,
	height: 1375
};

export const micSetupPhoto: PhotoGalleryImage = {
	src: micSetupImage,
	alt: "Rode PodMic on a desk with a lamp and wood slat wall",
	width: 1280,
	height: 1920
};

export const leonardoDicaprioPhoto: PhotoGalleryImage = {
	src: leonardoDicaprioImage,
	alt: "Guest recording at a desk with a laptop and Rode microphone",
	width: 2560,
	height: 1920
};

export const behindTheScenesWidePhoto: PhotoGalleryImage = {
	src: behindTheScenesWideImage,
	alt: "Two-person interview with cameras, overhead light, and engineer at a laptop",
	width: 1971,
	height: 1110
};

export const girlNotSadPhoto: PhotoGalleryImage = {
	src: girlNotSadImage,
	alt: "Guest wearing headphones and speaking into a condenser microphone",
	width: 1060,
	height: 1885
};

export const behindTheScenesPhoto: PhotoGalleryImage = {
	src: behindTheScenesImage,
	alt: "Producer monitoring waveforms on a laptop while two guests record at a table",
	width: 1305,
	height: 2178
};

export const tableSetupPhoto: PhotoGalleryImage = {
	src: tableSetupImage,
	alt: "Symmetric table with two PodMics, lamps, and wood slat wall",
	width: 1885,
	height: 1060
};

export const trioTalkingAtTableSetupPhoto: PhotoGalleryImage = {
	src: trioTalkingAtTableSetupImage,
	alt: "Three people recording at a table with microphones, iPad multiview, and waveforms on screen",
	width: 1612,
	height: 1612
};

export const screenPhoto: PhotoGalleryImage = {
	src: screenImage,
	alt: "iPad monitor showing a live camera feed of a guest during recording",
	width: 1920,
	height: 1081
};

export const armchairVerticalPhoto: PhotoGalleryImage = {
	src: armchairVerticalImage,
	alt: "Single armchair with boom microphone, slat wall, and green wall",
	width: 1060,
	height: 1885
};

export const girlSingingPhoto: PhotoGalleryImage = {
	src: girlSingingImage,
	alt: "Woman wearing headphones at a Rode microphone during a session",
	width: 1788,
	height: 1117
};

export const musicSetupPhoto: PhotoGalleryImage = {
	src: musicSetupImage,
	alt: "Music recording setup with keyboard, microphones, and studio lighting",
	width: 1920,
	height: 1080
};

export const manAndWomanPhoto: PhotoGalleryImage = {
	src: manAndWomanImage,
	alt: "Man and woman recording an interview at a table with waveforms and a camera visible",
	width: 1205,
	height: 1205
};

export const timelinePhoto: PhotoGalleryImage = {
	src: timelineImage,
	alt: "Laptop showing live recording waveforms during a podcast interview at the desk",
	width: 1600,
	height: 1600
};

export const studioMicPhoto: PhotoGalleryImage = {
	src: micImage,
	alt: "Close-up of a Rode PodMic on a boom arm",
	width: 1600,
	height: 1836
};

const galleryImages: PhotoGalleryImage[] = [
	armchairSetupPhoto,
	expressiveManPhoto,
	micSetupPhoto,
	leonardoDicaprioPhoto,
	behindTheScenesWidePhoto,
	girlNotSadPhoto,
	behindTheScenesPhoto,
	tableSetupPhoto,
	trioTalkingAtTableSetupPhoto,
	screenPhoto,
	armchairVerticalPhoto,
	girlSingingPhoto
];

export const landingSetupImages: PhotoGalleryImage[] = [
	{ ...armchairSetupPhoto, caption: "The Armchair Setup" },
	{ ...tableSetupPhoto, caption: "The Table Setup" },
	{ ...musicSetupPhoto, caption: "The Music Setup" }
];

export const photosPageContent: PhotosPageContent = {
	title: "What to expect at VV Studios",
	lead: "VV Studios is a multimedia space in South West Sydney specialising in top-quality audio-visual production. We offer 4K video and industry-standard audio equipment to ensure your content shines.",
	bookCta: "Book session",
	tourCta: "Take free tour",
	tourDialogLabel: "Take a free tour",
	tourDialogDescription: "See the studio space before you book.",
	tourDialogCloseLabel: "Close",
	tourIframeTitle: "Free studio tour booking",
	galleryImages
};
