import { createFileRoute } from "@tanstack/react-router";
import { PricingSection } from "#/components/pricing/PricingSection";
import { faqSectionCopy } from "#/components/faq/FaqSection";
import { LandingFaq } from "#/components/landing/LandingFaq";
import { LandingGallery } from "#/components/landing/LandingGallery";
import { LandingHero } from "#/components/landing/LandingHero";
import { LandingTestimonials } from "#/components/landing/LandingTestimonials";
import {
	buildFaqPageJsonLd,
	buildLocalBusinessJsonLd,
	buildSeoHead,
	buildWebSiteJsonLd,
	seoMetadata,
} from "#/lib/seo";

export const Route = createFileRoute("/")({
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

function HomePage() {
	return (
		<main className="-mt-18 md:-mt-28">
			<LandingHero />
			<LandingTestimonials />
			<LandingGallery />
			<PricingSection
				compact
				className="bg-background text-foreground"
			/>
			<LandingFaq />
		</main>
	);
}
