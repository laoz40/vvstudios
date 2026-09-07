import { createFileRoute } from "@tanstack/react-router";
import { bookingCompleteSearchSchema } from "#studio/features/booking-complete/lib/booking-complete-search";
import { BookingCompletePage } from "#studio/features/booking-complete/components/BookingCompletePage";
import { buildNoIndexHead } from "#/lib/seo";

export const Route = createFileRoute("/_public/_convex/package-complete")({
	validateSearch: (search) => {
		const parsedSearch = bookingCompleteSearchSchema.safeParse(search);
		return parsedSearch.success ? parsedSearch.data : {};
	},
	head: () => buildNoIndexHead("Package Complete | VV Studios"),
	component: PackageCompletePage
});

function PackageCompletePage() {
	return <BookingCompletePage search={Route.useSearch()} />;
}
