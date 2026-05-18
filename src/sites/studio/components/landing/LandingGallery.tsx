import { PhotosSection } from "#studio/components/photos/PhotosSection";
import { landingMobileGalleryImages } from "#studio/content/photos";

export interface LandingGalleryProps {
	withTopSpacing?: boolean;
}

export function LandingGallery({ withTopSpacing = true }: LandingGalleryProps) {
	return (
		<PhotosSection
			headingLevel="h2"
			mobileImages={landingMobileGalleryImages}
			className={withTopSpacing ? "bg-background py-16 md:py-20" : "bg-background pt-0"}
		/>
	);
}
