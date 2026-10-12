"use node";

import { ok, okAsync, ResultAsync, safeTry } from "neverthrow";

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
	return safeTry(async function* () {
		yield* sendBookingReminderEmailForSession(ctx, claim.session);
		const result = yield* markReminderSentAfterEmail(ctx, bookingId, null);

		return ok(result);
	}).orElse((reminderError: { reason: string }) =>
		markReminderFailedAfterEmailError(ctx, bookingId, reminderError)
	);
}

export function sendSessionReminderWhenClaimed(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	claim: ReminderClaim | null
): ResultAsync<null, never> {
	return safeTry(async function* () {
		yield* ResultAsync.combine(
			selectClaimedReminderSessions(claim).map((session) =>
				deliverClaimedSessionReminderEmail(ctx, bookingId, { session })
			)
		);

		return ok(null);
	});
}
