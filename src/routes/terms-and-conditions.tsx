import { createFileRoute } from "@tanstack/react-router";
import { buildSeoHead, seoMetadata } from "#/lib/seo";
import { TermsAndConditionsPage } from "#studio/pages/TermsAndConditionsPage";

export const Route = createFileRoute("/terms-and-conditions")({
	head: () => buildSeoHead(seoMetadata.termsAndConditions),
	component: TermsAndConditionsPage,
});
