import { createFileRoute, redirect } from "@tanstack/react-router";
import { bookingCompleteSearchSchema } from "#studio/features/booking-complete/lib/booking-complete-search";
import { studioSite } from "#/config/sites";

export const Route = createFileRoute("/_public/_convex/package-complete")({
	beforeLoad: ({ search }) => {
		const parsedSearch = bookingCompleteSearchSchema.safeParse(search);

		throw redirect({
			to: studioSite.routes.bookingComplete,
			search: parsedSearch.success ? parsedSearch.data : {}
		});
	}
});
