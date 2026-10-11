"use node";

import type { ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { createBookingInvoiceArtifactsForBooking } from "#studio/features/booking-invoice/lib/booking-artifacts";
import type { AdminSessionUpdateResult } from "#convex/sessions/lib/adminEdit";
import { getSessionFromQuery } from "#convex/sessions/services/lookup";
import { sendBookingRescheduledCustomerEmail } from "#convex/email/services/bookingCustomerEmails";
import { sendSessionHostDetailsEmail } from "#convex/email/services/hostBookingEmails";
import {
	bookingRescheduledCustomerEmailArgs,
	bookingInvoiceArtifactCreatedAt,
	hostRescheduleEmailArgs,
	logAdminHostRescheduleEmailFailure,
	logCustomerHostRescheduleEmailFailure,
	logSessionHostRescheduleEmailFailure,
	type HostRescheduleBooking
} from "#convex/sessions/lib/rescheduleEmails";

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
	}).orElse((error: { reason: string }) =>
		logCustomerHostRescheduleEmailFailure(booking._id, error)
	);
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
	return sendBookingRescheduledCustomerEmail(
		bookingRescheduledCustomerEmailArgs(booking, options)
	).andThen(() => afterCustomerRescheduleEmailStep(booking, options));
}

export function sendSessionHostRescheduleEmailForBooking(
	booking: Doc<"bookings">,
	options: { leadTimeMinutes: number; originalDate: string; originalTime: string }
): ResultAsync<null, { reason: "INVALID_BOOKING_DATA" | "HOST_EMAIL_SEND_FAILED" }> {
	return createBookingInvoiceArtifactsForBooking(
		booking,
		bookingInvoiceArtifactCreatedAt(booking),
		{ leadTimeMinutes: options.leadTimeMinutes }
	).asyncAndThen((value) => sendSessionHostEmailFromArtifacts(booking, options, value));
}

function sendSessionHostEmailFromArtifacts(
	booking: Doc<"bookings">,
	options: { leadTimeMinutes: number; originalDate: string; originalTime: string },
	value: { artifacts: { data: { invoice: { number: string } } }; booking: HostRescheduleBooking }
) {
	return sendSessionHostDetailsEmail(
		hostRescheduleEmailArgs(value.booking, value.artifacts.data.invoice.number, options)
	).orElse((error: { reason: string }) => logSessionHostRescheduleEmailFailure(booking._id, error));
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
			logAdminHostRescheduleEmailFailure(updatedSession._id, error)
		)
		.map(() => args.result);
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
