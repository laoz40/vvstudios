"use node";

import { okAsync, type Result } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { sendBookingReminderEmailForSession } from "#convex/lib/booking/bookingConfirmation";
import { fromConvexTuple } from "#convex/lib/result";

export async function sendSessionReminderEmailService(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings"> }
): Promise<Result<null, never>> {
	const now = Date.now();

	return await fromConvexTuple(
		ctx.runMutation(internal.sessionReminders.claimReminder, { bookingId: args.bookingId, now })
	)
		.map((claim) => ({ kind: "claimed" as const, claim }))
		.orElse(() => okAsync({ kind: "skipped" as const }))
		// A failed or duplicate claim means this worker has nothing to deliver.
		.andThen((claimState) => {
			if (claimState.kind === "skipped") return okAsync(null);

			return (
				sendBookingReminderEmailForSession(ctx, claimState.claim.session)
					// Record successful delivery and clear the reminder claim.
					.andThen(() =>
						fromConvexTuple(
							ctx.runMutation(internal.sessionReminders.markReminderSent, {
								bookingId: args.bookingId,
								now: Date.now()
							})
						).map(() => null)
					)
					// Delivery failures are persisted for retry rather than returned to the scheduler.
					.orElse((reminderError) =>
						fromConvexTuple(
							ctx.runMutation(internal.sessionReminders.markReminderFailed, {
								bookingId: args.bookingId,
								failureCode: reminderError.reason
							})
						)
							.map(() => null)
							.orElse(() => okAsync(null))
					)
			);
		})
		.orElse(() => okAsync(null));
}
