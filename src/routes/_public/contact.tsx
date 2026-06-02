import { createFileRoute } from "@tanstack/react-router";
import { buildSeoHead, seoMetadata } from "#/lib/seo";
import { ContactActions } from "#studio/components/contact/ContactActions";
import { ContactCard } from "#studio/components/contact/ContactCard";
import { FaqSection } from "#studio/components/faq/FaqSection";

export const Route = createFileRoute("/_public/contact")({
	head: () => buildSeoHead(seoMetadata.contact),
	component: ContactRoute,
});

function ContactRoute() {
	return (
		<section className="px-4 pb-12 sm:pb-16">
			<div className="mx-auto w-full max-w-2xl">
				<ContactCard />
			</div>
			<FaqSection
				id="contact-faq-title"
				className="mx-auto mt-16 w-full max-w-6xl"
			/>
			<ContactActions />
		</section>
	);
}
