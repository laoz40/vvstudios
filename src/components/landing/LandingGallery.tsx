import { PhotosSection } from "#/components/photos/PhotosSection";

export interface LandingGalleryProps {
	withTopSpacing?: boolean;
}

export function LandingGallery({ withTopSpacing = true }: LandingGalleryProps) {
	return (
		<PhotosSection
			headingLevel="h2"
			className={withTopSpacing ? "bg-background pt-16 md:pt-20" : "bg-background pt-0"}
		/>
	);
}
