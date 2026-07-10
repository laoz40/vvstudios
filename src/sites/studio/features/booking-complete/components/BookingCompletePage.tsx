import { type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	BookingCompleteDevScenarioPanel,
	buildDevBooking,
	type BookingCompleteSearch
} from "#studio/components/booking/BookingCompleteDevScenarioPanel";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { BookingResult } from "#studio/features/booking-complete/components/BookingResult";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import {
	canCreateFailedBookingRescheduleLink,
	getBookingResultContent,
	getMultiBookingResultContent
} from "#studio/features/booking-complete/lib/booking-result-content";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { studioSite } from "#/config/sites";
export function BookingCompletePage({
	search: {
		dev_scenario: devScenario,
		multi_booking_id: multiBookingId,
		package_size: packageSize,
		session_id: stripeSessionId
	}
}: {
	search: BookingCompleteSearch;
}): ReactNode {
	const activeDevScenario = import.meta.env.DEV ? devScenario : undefined;
	const usableStripeSessionId =
		stripeSessionId && stripeSessionId !== "{CHECKOUT_SESSION_ID}" ? stripeSessionId : null;
	const liveBooking = useQuery(
		api.bookings.getBookingStatusByStripeSessionId,
		usableStripeSessionId && !activeDevScenario
			? { stripeSessionId: usableStripeSessionId }
			: "skip"
	);
	const booking = activeDevScenario ? buildDevBooking(activeDevScenario) : liveBooking;
	const previewStripeSessionId =
		usableStripeSessionId ?? (activeDevScenario ? "dev_checkout_session" : null);
	const isLoading =
		!activeDevScenario && Boolean(usableStripeSessionId) && liveBooking === undefined;

	if ((multiBookingId && packageSize) || activeDevScenario === "package_request") {
		const previewPackageSize = packageSize ?? 8;
		return (
			<BookingStatusLayout
				bookingStatus="confirmed"
				instagramPromptTarget={{
					kind: "multiBooking",
					multiBookingId: (multiBookingId ??
						"dev-multi-booking-package") as Id<"multiBookingPackages">
				}}
				stripeSessionId={null}>
				<BookingResult
					booking={null}
					content={getMultiBookingResultContent(previewPackageSize)}
					invoiceDownloadTarget={{
						kind: "multiBooking",
						multiBookingId: (multiBookingId ??
							"dev-multi-booking-package") as Id<"multiBookingPackages">
					}}
					showBookingDetails={false}
				/>
			</BookingStatusLayout>
		);
	}

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
						isBookingCompletionFailure: false
					}}
				/>
			</BookingStatusLayout>
		);
	}

	if (isLoading) {
		return (
			<BookingStatusLayout showActions={false}>
				<StudioLoadingState label="Creating your booking..." />
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
						isBookingCompletionFailure: false
					}}
				/>
			</BookingStatusLayout>
		);
	}

	if (booking.status === "pending_payment") {
		return (
			<BookingStatusLayout showActions={false}>
				<StudioLoadingState label="Creating your booking..." />
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
	const canCreateRescheduleLink = canCreateFailedBookingRescheduleLink(booking);
	return (
		<BookingStatusLayout
			bookingStatus={booking.status}
			canCreateRescheduleLink={canCreateRescheduleLink}
			stripeSessionId={previewStripeSessionId}>
			<BookingResult
				booking={booking}
				content={resultContent}
				invoiceDownloadTarget={
					previewStripeSessionId
						? { kind: "booking", stripeSessionId: previewStripeSessionId }
						: undefined
				}
			/>
		</BookingStatusLayout>
	);
}
