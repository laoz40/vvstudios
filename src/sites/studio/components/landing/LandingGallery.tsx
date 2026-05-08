import { PhotosSection } from "#studio/components/photos/PhotosSection";

export interface LandingGalleryProps {
	withTopSpacing?: boolean;
}

export function LandingGallery({ withTopSpacing = true }: LandingGalleryProps) {
	return (
		<PhotosSection
			headingLevel="h2"
			className={withTopSpacing ? "bg-background py-16 md:py-20" : "bg-background pt-0"}
		/>
	);
}
