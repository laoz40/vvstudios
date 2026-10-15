"use node";

import { errAsync, ok, okAsync, safeTry } from "neverthrow";
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
	}).orElse(() => okAsync(null));
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
		hostRescheduleEmailArgs(
			booking._id,
			value.booking,
			value.artifacts.data.invoice.number,
			options
		)
	).orElse(() => errAsync({ reason: "HOST_EMAIL_SEND_FAILED" as const }));
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
		.orElse(() => okAsync(null))
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
