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
	getPackageResultContent
} from "#studio/features/booking-complete/lib/booking-result-content";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { studioSite } from "#/config/sites";
import { z } from "zod";

const packageIdSchema = z.custom<Id<"packages">>(
	(value) => z.string().min(1).safeParse(value).success
);
const DEV_PACKAGE_ID = packageIdSchema.parse("dev-package");
function useBookingCompletePageData(search: BookingCompleteSearch) {
	const activeDevScenario = import.meta.env.DEV ? search.dev_scenario : undefined;
	const stripeSessionId = search.session_id;
	const usableStripeSessionId = [undefined, "", "{CHECKOUT_SESSION_ID}"].includes(stripeSessionId)
		? null
		: stripeSessionId;
	const bookingQueryArgs: "skip" | { stripeSessionId: string } =
		usableStripeSessionId && !activeDevScenario
			? { stripeSessionId: usableStripeSessionId }
			: "skip";
	const liveBooking = useQuery(api.sessions.getSessionStatusByStripeSessionId, bookingQueryArgs);

	return {
		booking: activeDevScenario ? buildDevBooking(activeDevScenario) : liveBooking,
		hasBookingRequest: Boolean(stripeSessionId || activeDevScenario),
		isLoading: bookingQueryArgs !== "skip" && liveBooking === undefined,
		isPackageRequest:
			Boolean(search.package_id && search.package_size) || activeDevScenario === "package_request",
		packageId: search.package_id,
		packageSize: search.package_size,
		previewStripeSessionId:
			usableStripeSessionId ?? (activeDevScenario ? "dev_checkout_session" : null),
		usableStripeSessionId
	};
}

export function BookingCompletePage({ search }: { search: BookingCompleteSearch }): ReactNode {
	const {
		booking,
		hasBookingRequest,
		isLoading,
		isPackageRequest,
		packageId,
		packageSize,
		previewStripeSessionId,
		usableStripeSessionId
	} = useBookingCompletePageData(search);

	if (isPackageRequest) {
		const previewPackageSize = packageSize ?? 8;
		const previewPackageId = packageId ? packageIdSchema.parse(packageId) : DEV_PACKAGE_ID;
		return (
			<BookingStatusLayout
				bookingStatus="confirmed"
				instagramPromptTarget={{ kind: "package", packageId: previewPackageId }}
				stripeSessionId={null}>
				<BookingResult
					booking={null}
					content={getPackageResultContent(previewPackageSize)}
					invoiceDownloadTarget={{ kind: "package", packageId: previewPackageId }}
					showBookingDetails={false}
				/>
			</BookingStatusLayout>
		);
	}

	if (!hasBookingRequest) {
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
