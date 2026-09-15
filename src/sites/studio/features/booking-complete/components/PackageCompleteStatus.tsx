import { type ReactNode } from "react";
import { Navigate } from "@tanstack/react-router";
import { StudioLoadingState } from "#studio/components/StudioLoadingState";
import { BookingResult } from "#studio/features/booking-complete/components/BookingResult";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import {
	getPackagePaidResultContent,
	getPackageReceiptEmailFailedResultContent
} from "#studio/features/booking-complete/lib/booking-result-content";
import type { Doc } from "#convex/_generated/dataModel";
import { studioSite } from "#/config/sites";
import { exhaustiveCheck } from "#/lib/result";

type PackageCompleteStatusRecord = Pick<Doc<"packages">, "_id" | "status" | "packageSize">;

export function PackageCompleteStatus({
	packageRecord,
	previewStripeSessionId,
	usableStripeSessionId
}: {
	packageRecord: PackageCompleteStatusRecord;
	previewStripeSessionId: string | null;
	usableStripeSessionId: string | null;
}): ReactNode {
	const packageStatus = packageRecord.status;

	switch (packageStatus) {
		case "pending_payment":
			return (
				<BookingStatusLayout showActions={false}>
					<StudioLoadingState label="Confirming your package..." />
				</BookingStatusLayout>
			);
		case "paid":
		case "schedule_email_failed":
			return (
				<BookingStatusLayout
					bookingStatus="confirmed"
					instagramPromptTarget={{ kind: "package", packageId: packageRecord._id }}
					stripeSessionId={previewStripeSessionId}>
					<BookingResult
						booking={null}
						content={getPackagePaidResultContent(packageRecord.packageSize)}
						invoiceDownloadTarget={{ kind: "package", packageId: packageRecord._id }}
						showBookingDetails={false}
					/>
				</BookingStatusLayout>
			);
		case "expired":
			return (
				<Navigate
					to={studioSite.routes.bookingExpired}
					search={{ session_id: usableStripeSessionId ?? undefined }}
				/>
			);
		case "abandoned":
			return (
				<BookingStatusLayout>
					<BookingResult
						booking={null}
						content={{
							title: "This checkout session was closed",
							description: "Please return to the booking form to start a new checkout session.",
							isBookingCompletionFailure: false
						}}
					/>
				</BookingStatusLayout>
			);
		case "invoice_email_failed":
			return (
				<BookingStatusLayout
					bookingStatus="confirmed"
					instagramPromptTarget={{ kind: "package", packageId: packageRecord._id }}
					stripeSessionId={previewStripeSessionId}>
					<BookingResult
						booking={null}
						content={getPackageReceiptEmailFailedResultContent(packageRecord.packageSize)}
						invoiceDownloadTarget={{ kind: "package", packageId: packageRecord._id }}
						showBookingDetails={false}
					/>
				</BookingStatusLayout>
			);
		default:
			return exhaustiveCheck(packageStatus);
	}
}
