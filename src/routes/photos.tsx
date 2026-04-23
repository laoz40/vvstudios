import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "#/components/site/placeholder-page";

export const Route = createFileRoute("/photos")({
	component: PhotosPage,
});

function PhotosPage() {
	return (
		<PlaceholderPage
			title="Photos page coming next."
			body="This route is a temporary placeholder so the old Astro navigation can be ported over without changing the booking flow implementation."
		/>
	);
}
