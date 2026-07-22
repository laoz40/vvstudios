import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "#convex/_generated/api";
import type { GetPublicRescheduleCompleteBookingResult } from "#convex/bookings";
import type { Result } from "#/lib/result";
import { buildNoIndexHead } from "#/lib/seo";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import { RescheduleConfirmation } from "#studio/features/booking-complete/components/RescheduleConfirmation";
import {
	parseRescheduleCompleteSearch,
	RescheduleCompleteDevScenarioPanel,
	type DevRescheduleCompleteScenario
} from "#studio/components/booking/RescheduleCompleteDevScenarioPanel";

// Dev scenarios use a readable fake string ID, while live Convex results retain their branded booking ID.
type RescheduleCompleteBooking = Omit<
	NonNullable<GetPublicRescheduleCompleteBookingResult[1]>,
	"_id"
> & { _id: string };
type RescheduleCompletePageResult = Result<
	RescheduleCompleteBooking,
	NonNullable<GetPublicRescheduleCompleteBookingResult[0]>
>;

export const Route = createFileRoute("/_public/reschedule-complete")({
	validateSearch: parseRescheduleCompleteSearch,
	head: () => buildNoIndexHead("Reschedule Complete | VV Studios"),
	component: RescheduleCompletePage
});

function RescheduleCompletePage() {
	const { booking_id: bookingId, dev_scenario: devScenario } = Route.useSearch();
	const activeDevScenario = import.meta.env.DEV ? devScenario : undefined;
	const liveBookingResult: GetPublicRescheduleCompleteBookingResult | undefined = useQuery(
		api.bookings.getPublicRescheduleCompleteBooking,
		bookingId && !activeDevScenario ? { bookingId } : "skip"
	);
	const bookingResult = activeDevScenario
		? buildDevRescheduleCompleteBookingResult(activeDevScenario)
		: liveBookingResult;

	if (!bookingId && !activeDevScenario) {
		return <RescheduleCompleteMissing />;
	}

	if (bookingResult === undefined) {
		return (
			<BookingStatusLayout devPanel={<RescheduleCompleteDevScenarioPanel />}>
				<StudioLoadingState label="Saving your changes..." />
			</BookingStatusLayout>
		);
	}

	const [error, booking] = bookingResult;

	if (error !== null) {
		return <RescheduleCompleteMissing />;
	}

	return (
		<BookingStatusLayout
			bookingStatus="confirmed"
			devPanel={<RescheduleCompleteDevScenarioPanel />}>
			<RescheduleConfirmation
				addons={booking.addons}
				date={booking.date}
				duration={booking.duration}
				service={booking.service}
				time={booking.time}
			/>
		</BookingStatusLayout>
	);
}

function RescheduleCompleteMissing() {
	return (
		<BookingStatusLayout
			bookingStatus="failed"
			devPanel={<RescheduleCompleteDevScenarioPanel />}>
			<div>
				<h1 className="text-4xl font-semibold tracking-tight">Booking not found.</h1>
				<p className="mt-4 text-muted-foreground">
					We couldn’t find this rescheduled booking. Please contact us and we’ll help you.
				</p>
			</div>
		</BookingStatusLayout>
	);
}

function buildDevRescheduleCompleteBookingResult(
	devScenario: DevRescheduleCompleteScenario
): RescheduleCompletePageResult | undefined {
	if (devScenario === "loading") {
		return undefined;
	}

	if (devScenario === "booking_not_found") {
		return [{ reason: "BOOKING_NOT_FOUND" }, null];
	}

	return [
		null,
		{
			_id: "dev-reschedule-booking",
			status: "confirmed",
			bookingConfirmedAt: Date.now(),
			bookingFailureCode: undefined,
			pendingPaymentCreatedAt: Date.now(),
			paymentCompletedAt: Date.now(),
			date: "2026-05-12",
			time: "10:00",
			duration: "2h",
			service: "Table Setup",
			addons: ["Essential Edit", "Clips Package"],
			essentialEditQuantity: "1",
			clipsPackageQuantity: "2"
		}
	];
}
