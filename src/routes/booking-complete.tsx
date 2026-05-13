import type { ReactNode } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	BookingCompleteDevScenarioPanel,
	buildDevBooking,
	parseBookingCompleteSearch,
} from "#studio/components/booking/BookingCompleteDevScenarioPanel";
import { BookingProcessing } from "#studio/features/booking-complete/components/BookingProcessing";
import { BookingResult } from "#studio/features/booking-complete/components/BookingResult";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import { getBookingResultContent } from "#studio/features/booking-complete/lib/booking-result-content";
import { api } from "#convex/_generated/api";
import { studioSite } from "#/config/sites";
import { buildNoIndexHead } from "#/lib/seo";

export const Route = createFileRoute("/booking-complete")({
	validateSearch: parseBookingCompleteSearch,
	head: () => buildNoIndexHead("Booking Complete | VV Studios"),
	component: BookingCompletePage,
});

function BookingCompletePage(): ReactNode {
	const { dev_scenario: devScenario, session_id: stripeSessionId } = Route.useSearch();
	const activeDevScenario = import.meta.env.DEV ? devScenario : undefined;
	const usableStripeSessionId =
		stripeSessionId && stripeSessionId !== "{CHECKOUT_SESSION_ID}" ? stripeSessionId : null;
	const liveBooking = useQuery(
		api.bookings.getBookingStatusByStripeSessionId,
		usableStripeSessionId && !activeDevScenario
			? { stripeSessionId: usableStripeSessionId }
			: "skip",
	);
	const booking = activeDevScenario ? buildDevBooking(activeDevScenario) : liveBooking;
	const isLoading =
		!activeDevScenario && Boolean(usableStripeSessionId) && liveBooking === undefined;

	if (!stripeSessionId && !activeDevScenario) {
		return (
			<BookingStatusLayout>
				{import.meta.env.DEV ? <BookingCompleteDevScenarioPanel /> : null}
				<BookingResult
					booking={null}
					content={{
						title: "No booking session was provided",
						description:
							"This page needs a valid booking session link. Try returning to the booking form to start a new checkout session.",
						isBookingCompletionFailure: false,
					}}
				/>
			</BookingStatusLayout>
		);
	}

	if (isLoading) {
		return (
			<BookingStatusLayout showActions={false}>
				<BookingProcessing />
			</BookingStatusLayout>
		);
	}

	if (!booking) {
		return (
			<BookingStatusLayout>
				<BookingResult
					booking={null}
					content={{
						title: "We couldn't find this booking",
						description: "The link may be invalid or no longer available.",
						isBookingCompletionFailure: false,
					}}
				/>
			</BookingStatusLayout>
		);
	}

	if (booking.status === "pending_payment") {
		return (
			<BookingStatusLayout showActions={false}>
				<BookingProcessing />
			</BookingStatusLayout>
		);
	}

	if (booking.status === "expired") {
		return (
			<Navigate
				to={studioSite.routes.bookingExpired}
				search={{ session_id: usableStripeSessionId ?? undefined }}
			/>
		);
	}

	const resultContent = getBookingResultContent(booking);

	return (
		<BookingStatusLayout bookingStatus={booking.status}>
			<BookingResult
				booking={booking}
				content={resultContent}
				stripeSessionId={usableStripeSessionId}
			/>
		</BookingStatusLayout>
	);
}
