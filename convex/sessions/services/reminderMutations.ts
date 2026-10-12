import { ok, safeTry } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	getTomorrowTimeZoneDayRange,
	REMINDER_TIME_ZONE
} from "#convex/shared/lib/reminderScheduleTime";
import { getSessionFromDb } from "#convex/sessions/services/lookup";
import {
	patchSessionReminderEmailClaimed,
	patchSessionReminderEmailFailed,
	patchSessionReminderEmailSent,
	takeConfirmedBookingsInReminderWindow,
	validateSendableUnclaimedReminder
} from "#convex/sessions/lib/reminderDb";

type ReminderBookingArgs = { bookingId: Id<"bookings"> };

function claimReminderAfterSessionStep(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { now: number },

	session: Doc<"bookings">
) {
	return safeTry(async function* () {
		yield* patchSessionReminderEmailClaimed(ctx, args);

		return ok({ session });
	});
}

export function getTomorrowSessionReminderWindow(nowDate: Date) {
	return getTomorrowTimeZoneDayRange(nowDate, REMINDER_TIME_ZONE);
}

export function listConfirmedSessionsDueForReminderEmail(
	ctx: QueryCtx,
	args: { dayStart: number; dayEnd: number; limit?: number }
) {
	return takeConfirmedBookingsInReminderWindow(ctx, args);
}

export function claimSessionReminderEmail(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { now: number }
) {
	return safeTry(async function* () {
		const session = yield* getSessionFromDb(ctx, args.bookingId);
		const sendableSession = yield* validateSendableUnclaimedReminder(session);
		const claim = yield* claimReminderAfterSessionStep(ctx, args, sendableSession);

		return ok(claim);
	});
}

export function writeSessionReminderEmailSent(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { now: number }
) {
	return safeTry(async function* () {
		yield* getSessionFromDb(ctx, args.bookingId);
		const updatedSession = yield* patchSessionReminderEmailSent(ctx, args);

		return ok(updatedSession);
	});
}

export function writeSessionReminderEmailFailed(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { failureCode: string }
) {
	return safeTry(async function* () {
		yield* getSessionFromDb(ctx, args.bookingId);
		const updatedSession = yield* patchSessionReminderEmailFailed(ctx, args);

		return ok(updatedSession);
	});
}
