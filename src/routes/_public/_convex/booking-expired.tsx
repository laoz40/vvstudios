import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { z } from "zod";
import { BookingOutcomeActions } from "#studio/components/booking/BookingOutcomeActions";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { api } from "#convex/_generated/api";
import { buildNoIndexHead } from "#/lib/seo";
import { cn } from "#/lib/utils";

const bookingExpiredSearchSchema = z.object({ session_id: z.string().min(1) });

export const Route = createFileRoute("/_public/_convex/booking-expired")({
	head: () => buildNoIndexHead("Booking Session Expired | VV Studios"),
	validateSearch: (search) => {
		const parsedSearch = bookingExpiredSearchSchema.safeParse(search);

		return { session_id: parsedSearch.success ? parsedSearch.data.session_id : undefined };
	},
	component: BookingExpiredPage
});

function BookingExpiredPage() {
	const { session_id: stripeSessionId } = Route.useSearch();
	const booking = useQuery(
		api.sessions.getSessionStatusByStripeSessionId,
		stripeSessionId ? { stripeSessionId } : "skip"
	);
	const supportReference = booking
		? Number.isFinite(booking.pendingPaymentCreatedAt)
			? formatBookingInvoiceNumber(booking._id, booking.pendingPaymentCreatedAt)
			: null
		: null;

	return (
		<main
			className={cn(
				"mx-auto flex min-h-screen w-full max-w-3xl flex-1 flex-col justify-center",
				"gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10"
			)}>
			<section className="flex flex-col gap-8">
				<div className="space-y-4">
					<h1 className="text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl">
						Your payment session expired
					</h1>
					<p className="max-w-2xl text-base text-muted-foreground">
						The booking deposit wasn&apos;t completed in time, so this checkout session is no longer
						available.
					</p>
					{supportReference ? (
						<p className="text-sm text-muted-foreground">
							Support reference:{" "}
							<span className="font-medium text-foreground">{supportReference}</span>
						</p>
					) : null}
				</div>

				<BookingOutcomeActions
					outcome="book-again-home"
					primaryLabel="Try again"
				/>
			</section>
		</main>
	);
}
