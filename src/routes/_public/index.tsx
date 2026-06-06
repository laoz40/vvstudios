import { createFileRoute } from "@tanstack/react-router";
import { faqSectionCopy } from "#studio/components/faq/FaqSection";
import { LandingFaq } from "#studio/components/landing/LandingFaq";
import { LandingGallery } from "#studio/components/landing/LandingGallery";
import { LandingHero } from "#studio/components/landing/LandingHero";
import { LandingTestimonials } from "#studio/components/landing/LandingTestimonials";
import { PricingSection } from "#studio/components/pricing/PricingSection";
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
	component: HomeRoute,
});

function HomeRoute() {
	return (
		// Cancels StudioLayout's top padding so the landing hero starts behind the navbar.
		<main className="-mt-18 md:-mt-24">
			<LandingHero />
			<div className="landing-page-content-overlap relative z-10 flex flex-col gap-16 bg-background md:gap-20">
				<LandingTestimonials />
				<LandingGallery />
				<PricingSection
					compact
					fadeIn
					className="bg-background text-foreground"
				/>
				<LandingFaq />
			</div>
		</main>
	);
}
