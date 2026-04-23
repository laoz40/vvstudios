import { createFileRoute } from "@tanstack/react-router";
import { PlaceholderPage } from "#/components/PlaceholderPage";

export const Route = createFileRoute("/pricing")({
	component: PricingPage,
});

function PricingPage() {
	return (
		<PlaceholderPage
			title="Pricing page coming next."
			body="This route is a temporary placeholder so the old Astro navigation can be ported over without changing the booking flow implementation."
		/>
	);
}
