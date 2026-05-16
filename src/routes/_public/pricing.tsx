import { createFileRoute } from "@tanstack/react-router";
import { PricingPage } from "#studio/pages/PricingPage";
import { buildSeoHead, seoMetadata } from "#/lib/seo";

export const Route = createFileRoute("/_public/pricing")({
	head: () => buildSeoHead(seoMetadata.pricing),
	component: PricingPage,
});
