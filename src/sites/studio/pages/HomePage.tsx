import { faqSectionCopy } from "#studio/components/faq/FaqSection";
import { LandingFaq } from "#studio/components/landing/LandingFaq";
import { LandingGallery } from "#studio/components/landing/LandingGallery";
import { LandingHero } from "#studio/components/landing/LandingHero";
import { LandingTestimonials } from "#studio/components/landing/LandingTestimonials";
import { PricingSection } from "#studio/components/pricing/PricingSection";

export { faqSectionCopy };

export function HomePage() {
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
