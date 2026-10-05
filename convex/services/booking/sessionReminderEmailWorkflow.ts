"use node";

import { okAsync, type ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { sendBookingReminderEmailForSession } from "#convex/lib/booking/bookingConfirmation";
import { fromConvexTuple } from "#convex/lib/result";

type ReminderClaim = { session: Doc<"bookings"> };

export function claimSessionReminderSend(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	now: number
): ResultAsync<ReminderClaim | null, never> {
	return fromConvexTuple(
		ctx.runMutation(internal.sessionReminders.claimReminder, { bookingId, now })
	)
		.map((claim): ReminderClaim => claim)
		.orElse(() => okAsync(null));
}

export function deliverClaimedSessionReminderEmail(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	claim: ReminderClaim
): ResultAsync<null, never> {
	return sendBookingReminderEmailForSession(ctx, claim.session)
		.andThen(() =>
			fromConvexTuple(
				ctx.runMutation(internal.sessionReminders.markReminderSent, { bookingId, now: Date.now() })
			).map(() => null)
		)
		.orElse((reminderError) =>
			fromConvexTuple(
				ctx.runMutation(internal.sessionReminders.markReminderFailed, {
					bookingId,
					failureCode: reminderError.reason
				})
			)
				.map(() => null)
				.orElse(() => okAsync(null))
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
