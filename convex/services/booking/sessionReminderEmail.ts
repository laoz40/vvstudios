"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { sendBookingReminderEmailForSession } from "#convex/services/booking/bookingConfirmationWorkflow";
import { fromConvexTuple } from "#convex/lib/result";

type ReminderClaim = { session: Doc<"bookings"> };

function reminderClaimFromMutation(claim: ReminderClaim) {
	return claim;
}

function markReminderSentAfterEmail(ctx: ActionCtx, bookingId: Id<"bookings">, _value: null) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionReminders.markReminderSent, { bookingId, now: Date.now() })
	).map(reminderEmailDeliveryComplete);
}

function reminderEmailDeliveryComplete() {
	return null;
}

function markReminderFailedAfterEmailError(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	reminderError: { reason: string }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionReminders.markReminderFailed, {
			bookingId,
			failureCode: reminderError.reason
		})
	)
		.map(reminderEmailDeliveryComplete)
		.orElse(reminderFailureRecordComplete);
}

function reminderFailureRecordComplete() {
	return okAsync(null);
}

function noopReminderClaimOnFailure() {
	return okAsync(null);
}

export function claimSessionReminderSend(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	now: number
): ResultAsync<ReminderClaim | null, never> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionReminders.claimReminder, { bookingId, now })
	)
		.map(reminderClaimFromMutation)
		.orElse(noopReminderClaimOnFailure);
}

export function deliverClaimedSessionReminderEmail(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	claim: ReminderClaim
): ResultAsync<null, never> {
	return sendBookingReminderEmailForSession(ctx, claim.session)
		.andThen((_value: null) => markReminderSentAfterEmail(ctx, bookingId, _value))
		.orElse((reminderError: { reason: string }) =>
			markReminderFailedAfterEmailError(ctx, bookingId, reminderError)
		);
}

export function sendSessionReminderWhenClaimed(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	claim: ReminderClaim | null
): ResultAsync<null, never> {
	if (claim === null) {
		return okAsync(null);
	}

	return deliverClaimedSessionReminderEmail(ctx, bookingId, claim);
}
