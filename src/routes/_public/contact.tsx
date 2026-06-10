import { createFileRoute } from "@tanstack/react-router";
import { buildSeoHead, seoMetadata } from "#/lib/seo";
import { ContactCard } from "#studio/components/contact/ContactCard";
import { LandingFaq } from "#studio/components/landing/LandingFaq";

export const Route = createFileRoute("/_public/contact")({
	head: () => buildSeoHead(seoMetadata.contact),
	component: ContactRoute
});

function ContactRoute() {
	return (
		<section className="px-4 pt-8 pb-12 sm:pt-10 sm:pb-16">
			<div className="mx-auto w-full max-w-2xl">
				<ContactCard />
			</div>
			<div className="mt-16">
				<LandingFaq id="contact-faq-title" />
			</div>
		</section>
	);
}
