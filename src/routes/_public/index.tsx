import { createFileRoute } from "@tanstack/react-router";
import { faqSectionCopy, HomePage } from "#studio/pages/HomePage";
import {
	buildFaqPageJsonLd,
	buildLocalBusinessJsonLd,
	buildSeoHead,
	buildWebSiteJsonLd,
	seoMetadata,
} from "#/lib/seo";

export const Route = createFileRoute("/_public/")({
	head: () => ({
		...buildSeoHead(seoMetadata.home),
		scripts: [
			{
				type: "application/ld+json",
				children: JSON.stringify(buildWebSiteJsonLd()),
			},
			{
				type: "application/ld+json",
				children: JSON.stringify(buildLocalBusinessJsonLd()),
			},
			{
				type: "application/ld+json",
				children: JSON.stringify(
					buildFaqPageJsonLd(
						faqSectionCopy.items.map((item) => ({
							question: item.question,
							answer: item.answerParts
								.map((part) => `${"heading" in part ? part.heading : ""}${part.value}`)
								.join("\n"),
						})),
					),
				),
			},
		],
	}),
	component: HomePage,
});
