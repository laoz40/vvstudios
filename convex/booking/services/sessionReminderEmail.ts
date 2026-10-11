"use node";

import { okAsync, ResultAsync } from "neverthrow";

import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { sendBookingReminderEmailForSession } from "#convex/booking/services/confirmationWorkflow";

import {
	claimReminderMutation,
	selectClaimedReminderSessions,
	markReminderSentAfterEmail,
	markReminderFailedAfterEmailError
} from "#convex/booking/lib/sessionReminderEmailSteps";

type ReminderClaim = { session: Doc<"bookings"> };

export function claimSessionReminderSend(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	now: number
): ResultAsync<ReminderClaim | null, never> {
	return claimReminderMutation(ctx, bookingId, now).orElse(() => okAsync(null));
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
	return ResultAsync.combine(
		selectClaimedReminderSessions(claim).map((session) =>
			deliverClaimedSessionReminderEmail(ctx, bookingId, { session })
		)
	).map(() => null);
}
