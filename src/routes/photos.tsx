import { createFileRoute } from "@tanstack/react-router";
import { LandingGallery } from "#/components/landing/LandingGallery";

export const Route = createFileRoute("/photos")({
	component: PhotosPage,
});

function PhotosPage() {
	return <LandingGallery withTopSpacing={false} />;
}
