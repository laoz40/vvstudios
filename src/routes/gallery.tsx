import { createFileRoute } from "@tanstack/react-router";
import { PhotosSection } from "#/components/photos/PhotosSection";
import { buildSeoHead, seoMetadata } from "#/lib/seo";

export const Route = createFileRoute("/gallery")({
	head: () => buildSeoHead(seoMetadata.gallery),
	component: GalleryPage,
});

function GalleryPage() {
	return (
		<PhotosSection
			headingLevel="h1"
			className="pt-0!"
		/>
	);
}
