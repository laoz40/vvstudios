"use node";

import { ok, safeTry, type ResultAsync } from "neverthrow";

import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/shared/services/requirePermissionActions";
import { sendBookingReceiptEmailsForBooking } from "#convex/booking/services/receiptEmails";
import { validateConfirmedSessionForReceiptResend } from "#convex/booking/lib/receipt";
import { queryBookingAvailabilitySettings } from "#convex/booking/lib/settingsIo";

import { createRescheduleUrlForSession } from "#convex/sessions/lib/rescheduleLinks";
import { getSessionFromQuery } from "#convex/sessions/services/lookup";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";
import {
	recordReceiptNumberMutation,
	ensureReceiptNumberMutation,
	markReceiptResendSent
} from "#convex/booking/lib/receiptResendSteps";

function recordReceiptNumberBeforeResendSent(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	receiptNumber: string
) {
	return safeTry(async function* () {
		yield* recordReceiptNumberMutation(ctx, session, receiptNumber);
		const result = yield* markReceiptResendSent(ctx, session);

		return ok(result);
	});
}

export function loadConfirmedSessionForReceiptResend(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): ResultAsync<Doc<"bookings">, { reason: string }> {
	return safeTry(async function* () {
		yield* requirePermissionActions(ctx, "send:receipt-emails");
		const session = yield* getSessionFromQuery(ctx, args.bookingId);
		const confirmedSession = yield* validateConfirmedSessionForReceiptResend(session);

		return ok(confirmedSession);
	});
}

export function writeStandaloneBookingReceiptNumber(
	ctx: ActionCtx,
	session: Doc<"bookings">
): ResultAsync<Doc<"bookings">, { reason: string }> {
	return safeTry(async function* () {
		yield* ensureReceiptNumberMutation(ctx, session);

		return ok(session);
	});
}

export function sendBookingReceiptEmailToCustomer(
	ctx: ActionCtx,
	session: Doc<"bookings">
): ResultAsync<{ receiptNumber: string; session: Doc<"bookings"> }, { reason: string }> {
	return safeTry(async function* () {
		const settings: BookingAvailabilitySettings = yield* queryBookingAvailabilitySettings(ctx);
		const sessionFromDb = yield* getSessionFromQuery(ctx, session._id);
		const rescheduleUrl = yield* createRescheduleUrlForSession(ctx, sessionFromDb);

		const { receiptNumber } = yield* sendBookingReceiptEmailsForBooking(sessionFromDb, {
			leadTimeMinutes: settings.leadTimeMinutes,
			rescheduleUrl,
			skipHostEmail: true
		});

		return ok({ session: sessionFromDb, receiptNumber });
	});
}

export function recordBookingReceiptResendOutcome(
	ctx: ActionCtx,
	args: { receiptNumber: string; session: Doc<"bookings"> }
): ResultAsync<null, { reason: string }> {
	return recordReceiptNumberBeforeResendSent(ctx, args.session, args.receiptNumber);
}
