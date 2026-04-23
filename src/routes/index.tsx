import { PlaceholderPage } from "#/components/PlaceholderPage";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
	component: HomePage,
});

function HomePage() {
	return (
		<PlaceholderPage
			title="Home Page"
			body="for now"
		/>
	);
}
