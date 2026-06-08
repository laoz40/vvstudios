import { PhotosSection } from "#studio/components/photos/PhotosSection";
import { landingGalleryImages } from "#studio/content/photos";

export function LandingGallery() {
	return (
		<PhotosSection
			headingLevel="h2"
			images={landingGalleryImages}
			layout="threeFeature"
			fadeIn
		/>
	);
}
