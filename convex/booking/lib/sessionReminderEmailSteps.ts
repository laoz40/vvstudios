"use node";

import { internal } from "#convex/_generated/api";
import { okAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";

import { fromConvexTuple } from "#convex/shared/lib/result";

export function selectClaimedReminderSessions(claim: { session: Doc<"bookings"> } | null) {
	return claim === null ? [] : [claim.session];
}

export function markReminderSentAfterEmail(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	_value: null
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.reminders.markReminderSent, { bookingId, now: Date.now() })
	).map(() => null);
}

export function markReminderFailedAfterEmailError(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	reminderError: { reason: string }
) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.reminders.markReminderFailed, {
			bookingId,
			failureCode: reminderError.reason
		})
	)
		.map(() => null)
		.orElse(() => okAsync(null));
}

export function claimReminderMutation(ctx: ActionCtx, bookingId: Id<"bookings">, now: number) {
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.reminders.claimReminder, { bookingId, now })
	);
}
