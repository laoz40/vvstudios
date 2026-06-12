import { createFileRoute } from "@tanstack/react-router";
import { buildSeoHead, seoMetadata } from "#/lib/seo";
import { PricingSection } from "#studio/components/pricing/PricingSection";

export const Route = createFileRoute("/_public/pricing")({
	head: () => buildSeoHead(seoMetadata.pricing),
	component: PricingRoute
});

function PricingRoute() {
	return (
		<PricingSection
			headingLevel="h1"
			className="pt-8 sm:pt-10"
		/>
	);
}
