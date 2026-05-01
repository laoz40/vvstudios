import { createFileRoute } from "@tanstack/react-router";
import { PricingSection } from "#/components/pricing/PricingSection";
import { buildSeoHead, seoMetadata } from "#/lib/seo";

export const Route = createFileRoute("/pricing")({
	head: () => buildSeoHead(seoMetadata.pricing),
	component: RoutePricingPage,
});

function RoutePricingPage() {
	return (
		<PricingSection
			headingLevel="h1"
			className="!pt-0"
		/>
	);
}
