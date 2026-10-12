"use node";

import { ok, safeTry } from "neverthrow";
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
) {
	return safeTry(async function* () {
		yield* sendBookingRescheduledCustomerEmail(
			bookingRescheduledCustomerEmailArgs(booking, options)
		);

		return ok(yield* afterCustomerRescheduleEmailStep(booking, options));
	});
}

export function sendSessionHostRescheduleEmailForBooking(
	booking: Doc<"bookings">,
	options: { leadTimeMinutes: number; originalDate: string; originalTime: string }
) {
	return safeTry(async function* () {
		const artifacts = yield* createBookingInvoiceArtifactsForBooking(
			booking,
			bookingInvoiceArtifactCreatedAt(booking),
			{ leadTimeMinutes: options.leadTimeMinutes }
		);

		return ok(yield* sendSessionHostEmailFromArtifacts(booking, options, artifacts));
	});
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
) {
	return safeTry(async function* () {
		const updatedSession = yield* getSessionFromQuery(ctx, args.bookingId);

		return ok(yield* notifyHostAfterAdminRescheduleStep(args, updatedSession));
	});
}
