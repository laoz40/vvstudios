import { createFileRoute } from "@tanstack/react-router";
import { bookingCompleteSearchSchema } from "#studio/features/booking-complete/lib/booking-complete-search";
import { BookingCompletePage } from "#studio/features/booking-complete/components/BookingCompletePage";
import { buildNoIndexHead } from "#/lib/seo";

export const Route = createFileRoute("/_public/_convex/booking-complete")({
	validateSearch: (search) => {
		const parsedSearch = bookingCompleteSearchSchema.safeParse(search);
		return parsedSearch.success ? parsedSearch.data : {};
	},
	head: () => buildNoIndexHead("Booking Complete | VV Studios"),
	component: SingleBookingCompletePage
});

function SingleBookingCompletePage() {
	return <BookingCompletePage search={Route.useSearch()} />;
}
