import { createFileRoute } from "@tanstack/react-router";
import { buildSeoHead, seoMetadata } from "#/lib/seo";
import { PhotosSection } from "#studio/components/photos/PhotosSection";

export const Route = createFileRoute("/_public/gallery")({
	head: () => buildSeoHead(seoMetadata.gallery),
	component: GalleryRoute,
});

function GalleryRoute() {
	return (
		<PhotosSection
			headingLevel="h1"
			className="pt-8 sm:pt-10"
		/>
	);
}
