import { errAsync, okAsync, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { createBookingInvoiceArtifactsForBooking } from "#studio/features/booking-invoice/lib/booking-artifacts";
import type { AdminSessionUpdateResult } from "#convex/sessions/lib/adminEdit";
import { getSessionFromQuery } from "#convex/sessions/services/lookup";
import { pickBookingAddonQuantities } from "#/domain/booking/addon-quantities";
import { sendBookingRescheduledCustomerEmail } from "#convex/email/services/bookingCustomerEmails";
import { sendSessionHostDetailsEmail } from "#convex/email/services/hostBookingEmails";

type BookingRescheduleEmailError =
	| { reason: "EMAIL_RENDER_FAILED" }
	| { reason: "EMAIL_REQUEST_FAILED" }
	| { reason: "EMAIL_RESPONSE_FAILED" }
	| { reason: "INVALID_BOOKING_DATA" };

function afterCustomerRescheduleEmailStep(
	booking: Doc<"bookings">,
	options: { leadTimeMinutes: number; originalDate: string; originalTime: string }
) {
	return sendSessionHostRescheduleEmailForBooking(booking, {
		leadTimeMinutes: options.leadTimeMinutes,
		originalDate: options.originalDate,
		originalTime: options.originalTime
	}).orElse((error: { reason: string }) => logHostRescheduleEmailFailureStep(booking._id, error));
}

function logHostRescheduleEmailFailureStep(bookingId: Id<"bookings">, error: { reason: string }) {
	console.error("Booking reschedule host email send failed", { bookingId, reason: error.reason });

	return okAsync(null);
}

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
	}).andThen(() => afterCustomerRescheduleEmailStep(booking, options));
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
	}).orElse((error: { reason: string }) => logSessionHostRescheduleFailureStep(booking._id, error));
}

function logSessionHostRescheduleFailureStep(bookingId: Id<"bookings">, error: { reason: string }) {
	console.error("Session reschedule host email send failed", { bookingId, reason: error.reason });

	return errAsync({ reason: "HOST_EMAIL_SEND_FAILED" as const });
}

function notifyHostAfterAdminRescheduleStep(
	args: {
		leadTimeMinutes: number;
		originalDate: string;
		originalTime: string;
		result: AdminSessionUpdateResult;
	},
	updatedSession: Doc<"bookings">
) {
	return sendSessionHostRescheduleEmailForBooking(updatedSession, {
		leadTimeMinutes: args.leadTimeMinutes,
		originalDate: args.originalDate,
		originalTime: args.originalTime
	})
		.orElse((error: { reason: string }) =>
			logAdminHostRescheduleFailureStep(updatedSession._id, error)
		)
		.map(() => retainAdminSessionUpdateResultStep(args.result));
}

function logAdminHostRescheduleFailureStep(bookingId: Id<"bookings">, error: { reason: string }) {
	console.error("Admin session reschedule host email send failed", {
		bookingId,
		reason: error.reason
	});

	return okAsync(null);
}

function retainAdminSessionUpdateResultStep(result: AdminSessionUpdateResult) {
	return result;
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
	return getSessionFromQuery(ctx, args.bookingId).andThen((updatedSession: Doc<"bookings">) =>
		notifyHostAfterAdminRescheduleStep(args, updatedSession)
	);
}
