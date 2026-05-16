import { createFileRoute } from "@tanstack/react-router";
import { ContactPage } from "#studio/components/contact/ContactPage";
import { buildSeoHead, seoMetadata } from "#/lib/seo";

export const Route = createFileRoute("/_public/contact")({
	head: () => buildSeoHead(seoMetadata.contact),
	component: ContactPage,
});
