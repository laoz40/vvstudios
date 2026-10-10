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

function pairClaimedSessionStep(session: Doc<"bookings">) {
	return { session };
}

function claimReminderAfterSessionStep(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { now: number },

	session: Doc<"bookings">
) {
	return patchSessionReminderEmailClaimed(ctx, args).map(() => pairClaimedSessionStep(session));
}

function patchReminderSentStep(ctx: MutationCtx, args: ReminderBookingArgs & { now: number }) {
	return patchSessionReminderEmailSent(ctx, args);
}

function patchReminderFailedStep(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { failureCode: string }
) {
	return patchSessionReminderEmailFailed(ctx, args);
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
	return getSessionFromDb(ctx, args.bookingId)
		.andThen(validateSendableUnclaimedReminder)
		.andThen((session: Doc<"bookings">) => claimReminderAfterSessionStep(ctx, args, session));
}

export function writeSessionReminderEmailSent(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { now: number }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen(() => patchReminderSentStep(ctx, args));
}

export function writeSessionReminderEmailFailed(
	ctx: MutationCtx,
	args: ReminderBookingArgs & { failureCode: string }
) {
	return getSessionFromDb(ctx, args.bookingId).andThen(() => patchReminderFailedStep(ctx, args));
}
