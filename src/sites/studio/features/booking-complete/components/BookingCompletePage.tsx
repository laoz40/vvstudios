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
import { PackageCompleteStatus } from "#studio/features/booking-complete/components/PackageCompleteStatus";
import {
	canCreateFailedBookingRescheduleLink,
	getBookingResultContent,
	getPackagePaidResultContent
} from "#studio/features/booking-complete/lib/booking-result-content";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { studioSite } from "#/config/sites";
import { z } from "zod";

const packageIdSchema = z.custom<Id<"packages">>(
	(value) => z.string().min(1).safeParse(value).success
);

const DEV_PACKAGE_ID = packageIdSchema.parse("dev-package");

function getUsableStripeSessionId(sessionId: string | undefined) {
	if ([undefined, "", "{CHECKOUT_SESSION_ID}"].includes(sessionId)) {
		return null;
	}

	return sessionId ?? null;
}

function useBookingCompletePageData(search: BookingCompleteSearch) {
	const activeDevScenario = import.meta.env.DEV ? search.dev_scenario : undefined;
	const usableStripeSessionId = getUsableStripeSessionId(search.session_id);

	const stripeQueryArgs: "skip" | { stripeSessionId: string } =
		usableStripeSessionId && !activeDevScenario
			? { stripeSessionId: usableStripeSessionId }
			: "skip";

	const liveBooking = useQuery(api.sessions.getSessionStatusByStripeSessionId, stripeQueryArgs);

	const livePackage = useQuery(
		api.packageCheckout.getPackageStatusByStripeSessionId,
		stripeQueryArgs !== "skip" && liveBooking === null ? stripeQueryArgs : "skip"
	);

	const isLoadingBooking = stripeQueryArgs !== "skip" && liveBooking === undefined;

	const isLoadingPackage =
		stripeQueryArgs !== "skip" && liveBooking === null && livePackage === undefined;

	return {
		booking: activeDevScenario ? buildDevBooking(activeDevScenario) : liveBooking,
		hasCheckoutRequest: Boolean(search.session_id || activeDevScenario),
		isLoading: isLoadingBooking || isLoadingPackage,
		package: livePackage,
		previewStripeSessionId:
			usableStripeSessionId ?? (activeDevScenario ? "dev_checkout_session" : null),
		usableStripeSessionId
	};
}

export function BookingCompletePage({ search }: { search: BookingCompleteSearch }): ReactNode {
	const activeDevScenario = import.meta.env.DEV ? search.dev_scenario : undefined;

	const {
		booking,
		hasCheckoutRequest,
		isLoading,
		package: packageRecord,
		previewStripeSessionId,
		usableStripeSessionId
	} = useBookingCompletePageData(search);

	if (activeDevScenario === "package_request") {
		return (
			<BookingStatusLayout
				bookingStatus="confirmed"
				instagramPromptTarget={{ kind: "package", packageId: DEV_PACKAGE_ID }}
				stripeSessionId={previewStripeSessionId}>
				<BookingResult
					booking={null}
					content={getPackagePaidResultContent(8)}
					invoiceDownloadTarget={{ kind: "package", packageId: DEV_PACKAGE_ID }}
					showBookingDetails={false}
				/>
			</BookingStatusLayout>
		);
	}

	if (!hasCheckoutRequest) {
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
				<StudioLoadingState label="Confirming your booking..." />
			</BookingStatusLayout>
		);
	}

	if (packageRecord) {
		return (
			<PackageCompleteStatus
				packageRecord={packageRecord}
				previewStripeSessionId={previewStripeSessionId}
				usableStripeSessionId={usableStripeSessionId}
			/>
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
