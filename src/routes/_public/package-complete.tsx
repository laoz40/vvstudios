import { createFileRoute } from "@tanstack/react-router";
import { parseBookingCompleteSearch } from "#studio/components/booking/BookingCompleteDevScenarioPanel";
import { BookingCompletePage } from "#studio/features/booking-complete/components/BookingCompletePage";
import { buildNoIndexHead } from "#/lib/seo";

export const Route = createFileRoute("/_public/package-complete")({
	validateSearch: parseBookingCompleteSearch,
	head: () => buildNoIndexHead("Package Complete | VV Studios"),
	component: PackageCompletePage
});

function PackageCompletePage() {
	return <BookingCompletePage search={Route.useSearch()} />;
}
