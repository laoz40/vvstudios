import { createFileRoute } from "@tanstack/react-router";
import { PricingSection } from "#/components/pricing/PricingSection";
import { LandingFaq } from "#/components/landing/LandingFaq";
import { LandingGallery } from "#/components/landing/LandingGallery";
import { LandingHero } from "#/components/landing/LandingHero";
import { Separator } from "#/components/ui/separator";
import { buildLocalBusinessJsonLd, buildSeoHead, seoMetadata } from "#/lib/seo";

export const Route = createFileRoute("/")({
	head: () => ({
		...buildSeoHead(seoMetadata.home),
		scripts: [
			{
				type: "application/ld+json",
				children: JSON.stringify(buildLocalBusinessJsonLd()),
			},
		],
	}),
	component: HomePage,
});

function HomePage() {
	return (
		<main className="-mt-18 md:-mt-28">
			<LandingHero />
			<LandingGallery />
			<Separator className="mx-auto my-4 max-w-6xl" />
			<PricingSection
				compact
				className="bg-background text-foreground"
			/>
			<Separator className="mx-auto my-4 max-w-6xl" />
			<LandingFaq />
		</main>
	);
}
