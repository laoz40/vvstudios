import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import HomeIcon from "#/components/ui/home-icon";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { api } from "#convex/_generated/api";
import { studioSite } from "#/config/sites";
import { buildNoIndexHead } from "#/lib/seo";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/_public/booking-expired")({
	head: () => buildNoIndexHead("Booking Session Expired | VV Studios"),
	validateSearch: (search: Record<string, unknown>) => ({
		session_id:
			typeof search.session_id === "string" && search.session_id.length > 0
				? search.session_id
				: undefined
	}),
	component: BookingExpiredPage
});

function BookingExpiredPage() {
	const { session_id: stripeSessionId } = Route.useSearch();
	const booking = useQuery(
		api.bookings.getBookingStatusByStripeSessionId,
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

				<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
					<AnimatedIconButton
						size="lg"
						className={cn(
							"h-auto w-full sm:w-auto",
							"px-8 py-3",
							"text-base font-medium",
							"shadow-lg shadow-primary/45"
						)}
						renderIcon={(iconRef) => (
							<ArrowNarrowRightIcon
								ref={iconRef}
								strokeWidth={3}
								className="translate-y-px"
								aria-hidden
							/>
						)}>
						<Link to={studioSite.routes.book}>Try again</Link>
					</AnimatedIconButton>
					<AnimatedIconButton
						size="lg"
						className={cn(
							"h-auto w-full sm:w-auto",
							"px-8 py-3",
							"text-base font-medium",
							"border-none shadow-md shadow-background/25"
						)}
						variant="outline"
						iconPosition="before"
						renderIcon={(iconRef) => (
							<HomeIcon
								ref={iconRef}
								aria-hidden
							/>
						)}>
						<Link to={studioSite.routes.home}>Return home</Link>
					</AnimatedIconButton>
				</div>
			</section>
		</main>
	);
}
