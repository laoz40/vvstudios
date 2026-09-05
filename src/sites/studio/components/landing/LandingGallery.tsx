import { PhotosSection } from "#studio/components/photos/PhotosSection";
import { landingGalleryImages } from "#studio/content/photos";
import { landingContactActionsClassName } from "#studio/lib/landing-styles";

export function LandingGallery() {
	return (
		<PhotosSection
			headingLevel="h2"
			images={landingGalleryImages}
			layout="threeFeature"
			fadeIn
			contactActionsClassName={landingContactActionsClassName}
		/>
	);
}
