import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Button } from "#/components/ui/button";
import { formatBookingInvoiceNumber } from "#/features/booking-invoice/lib/build-booking-invoice-data";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/booking-expired")({
	validateSearch: (search: Record<string, unknown>) => ({
		session_id:
			typeof search.session_id === "string" && search.session_id.length > 0
				? search.session_id
				: undefined,
	}),
	component: BookingExpiredPage,
});

function BookingExpiredPage() {
	const { session_id: stripeSessionId } = Route.useSearch();
	const booking = useQuery(
		api.bookings.getBookingStatusByStripeSessionId,
		stripeSessionId ? { stripeSessionId } : "skip",
	);
	const supportReference = booking
		? Number.isFinite(booking.pendingPaymentCreatedAt)
			? formatBookingInvoiceNumber(booking._id, booking.pendingPaymentCreatedAt)
			: null
		: null;

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10">
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

				<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
					<Button
						asChild
						className="w-full sm:w-auto">
						<Link to="/book">Try again</Link>
					</Button>
					<Button
						asChild
						className="w-full sm:w-auto"
						variant="outline">
						<Link to="/">Return home</Link>
					</Button>
				</div>
			</section>
		</main>
	);
}
