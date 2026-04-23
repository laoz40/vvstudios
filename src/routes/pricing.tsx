import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "#/components/pricing/PricingPage";

export const Route = createFileRoute("/pricing")({
	head: () => ({
		meta: [
			{
				title: "Podcast Studio Pricing | VV Podcast Studio",
			},
			{
				name: "description",
				content:
					"View VV Podcast Studio pricing for 1, 2, and 3 hour podcast and video sessions, plus optional add-ons including 4K recording, editing, and social clips.",
			},
		],
	}),
	component: RoutePricingPage,
});

function RoutePricingPage() {
	return <PricingPage />;
}
