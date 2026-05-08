import { createFileRoute } from "@tanstack/react-router";
import { GalleryPage } from "#studio/pages/GalleryPage";
import { buildSeoHead, seoMetadata } from "#/lib/seo";

export const Route = createFileRoute("/gallery")({
	head: () => buildSeoHead(seoMetadata.gallery),
	component: GalleryPage,
});
