import { createFileRoute } from "@tanstack/react-router";
import { buildSeoHead, seoMetadata } from "#/lib/seo";
import { StudioLegalPage } from "#studio/components/StudioLegalPage";
import { terms } from "#studio/features/booking-form/components/TermsDialog";

const lastUpdated = "11 May 2026";

export const Route = createFileRoute("/_public/terms-and-conditions")({
	head: () => buildSeoHead(seoMetadata.termsAndConditions),
	component: TermsAndConditionsPage
});

function TermsAndConditionsPage() {
	return (
		<StudioLegalPage
			title="Terms & Conditions"
			sections={terms}
			lastUpdated={lastUpdated}
		/>
	);
}
