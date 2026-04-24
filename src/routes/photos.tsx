import { createFileRoute } from "@tanstack/react-router";
import { PhotosSection } from "#/components/photos/PhotosSection";

export const Route = createFileRoute("/photos")({
	head: () => ({
		meta: [
			{
				title: "Podcast Studio Photos | VV Podcast Studio",
			},
			{
				name: "description",
				content:
					"Browse photos of VV Podcast Studio in Macquarie Fields and see the podcast sets, lighting, cameras, and recording environment available for business owners and creators in South West Sydney.",
			},
		],
	}),
	component: PhotosPage,
});

function PhotosPage() {
	return <PhotosSection headingLevel="h1" />;
}
