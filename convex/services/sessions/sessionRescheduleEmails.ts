import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { createBookingInvoiceArtifactsForBooking } from "#studio/features/booking-invoice/lib/booking-artifacts";
import type { AdminSessionUpdateResult } from "#convex/lib/sessions/sessionAdminEdit";
import { getSessionFromQuery } from "#convex/services/sessions/sessionLookup";
import { pickBookingAddonQuantities } from "#studio/features/booking-form/lib/booking-form-model";
import { sendBookingRescheduledCustomerEmail } from "#convex/services/email/bookingCustomerEmails";
import { sendSessionHostDetailsEmail } from "#convex/services/email/hostBookingEmails";

type BookingRescheduleEmailError =
	| { reason: "EMAIL_RENDER_FAILED" }
	| { reason: "EMAIL_REQUEST_FAILED" }
	| { reason: "EMAIL_RESPONSE_FAILED" }
	| { reason: "INVALID_BOOKING_DATA" };

export function sendBookingRescheduledEmailsForBooking(
	booking: Doc<"bookings">,
	options: {
		leadTimeMinutes: number;
		originalDate: string;
		originalTime: string;
		rescheduleUrl?: string;
	}
): ResultAsync<null, BookingRescheduleEmailError> {
	return sendBookingRescheduledCustomerEmail({
		addons: booking.addons,
		date: booking.date,
		duration: booking.duration,
		email: booking.email,
		name: booking.name,
		originalDate: options.originalDate,
		originalTime: options.originalTime,
		rescheduleUrl: options.rescheduleUrl,
		service: booking.service,
		time: booking.time,
		...pickBookingAddonQuantities(booking)
	}).andThen(() =>
		sendSessionHostRescheduleEmailForBooking(booking, {
			leadTimeMinutes: options.leadTimeMinutes,
			originalDate: options.originalDate,
			originalTime: options.originalTime
		}).orElse((error) => {
			console.error("Booking reschedule host email send failed", {
				bookingId: booking._id,
				reason: error.reason
			});

			return okAsync(null);
		})
	);
}

export function sendSessionHostRescheduleEmailForBooking(
	booking: Doc<"bookings">,
	options: { leadTimeMinutes: number; originalDate: string; originalTime: string }
): ResultAsync<null, { reason: "INVALID_BOOKING_DATA" | "HOST_EMAIL_SEND_FAILED" }> {
	const artifactsResult = createBookingInvoiceArtifactsForBooking(
		booking,
		booking.paymentCompletedAt ?? booking.bookingConfirmedAt ?? booking.pendingPaymentCreatedAt,
		{ leadTimeMinutes: options.leadTimeMinutes }
	);

	if (artifactsResult.isErr()) {
		return errAsync(artifactsResult.error);
	}

	const { artifacts, booking: parsedBooking } = artifactsResult.value;

	return sendSessionHostDetailsEmail({
		invoiceNumber: artifacts.data.invoice.number,
		name: parsedBooking.name,
		email: parsedBooking.email,
		phone: parsedBooking.phone,
		accountName: parsedBooking.accountName,
		abn: parsedBooking.abn,
		date: parsedBooking.date,
		time: parsedBooking.time,
		service: parsedBooking.service,
		duration: parsedBooking.duration,
		addons: parsedBooking.addons,
		notes: parsedBooking.notes,
		reschedule: { originalDate: options.originalDate, originalTime: options.originalTime },
		...pickBookingAddonQuantities(parsedBooking)
	}).orElse((error) => {
		console.error("Session reschedule host email send failed", {
			bookingId: booking._id,
			reason: error.reason
		});

		return errAsync({ reason: "HOST_EMAIL_SEND_FAILED" as const });
	});
}

export function notifyHostOfAdminSessionReschedule(
	ctx: ActionCtx,
	args: {
		bookingId: Id<"bookings">;
		leadTimeMinutes: number;
		originalDate: string;
		originalTime: string;
		result: AdminSessionUpdateResult;
	}
): ResultAsync<AdminSessionUpdateResult, { reason: "BOOKING_NOT_FOUND" }> {
	return getSessionFromQuery(ctx, args.bookingId).andThen((updatedSession) =>
		sendSessionHostRescheduleEmailForBooking(updatedSession, {
			leadTimeMinutes: args.leadTimeMinutes,
			originalDate: args.originalDate,
			originalTime: args.originalTime
		})
			.orElse((error) => {
				console.error("Admin session reschedule host email send failed", {
					bookingId: updatedSession._id,
					reason: error.reason
				});

				return okAsync(null);
			})
			.map(() => args.result)
	);
}
