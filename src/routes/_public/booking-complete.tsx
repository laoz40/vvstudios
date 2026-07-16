import { createFileRoute } from "@tanstack/react-router";
import { parseBookingCompleteSearch } from "#studio/components/booking/BookingCompleteDevScenarioPanel";
import { BookingCompletePage } from "#studio/features/booking-complete/components/BookingCompletePage";
import { buildNoIndexHead } from "#/lib/seo";

export const Route = createFileRoute("/_public/booking-complete")({
	validateSearch: parseBookingCompleteSearch,
	head: () => buildNoIndexHead("Booking Complete | VV Studios"),
	component: SingleBookingCompletePage
});

function SingleBookingCompletePage() {
	return <BookingCompletePage search={Route.useSearch()} />;
}
