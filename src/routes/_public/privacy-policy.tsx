import { createFileRoute } from "@tanstack/react-router";
import { buildSeoHead, seoMetadata } from "#/lib/seo";
import { PrivacyPolicyPage } from "#studio/pages/PrivacyPolicyPage";

export const Route = createFileRoute("/_public/privacy-policy")({
	head: () => buildSeoHead(seoMetadata.privacyPolicy),
	component: PrivacyPolicyPage,
});
