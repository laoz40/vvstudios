import { v } from "convex/values";
import { err, ok, tryCatch } from "../src/lib/result";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import {
	internalAction,
	internalMutation,
	internalQuery,
	type ActionCtx
} from "./_generated/server";
import {
	getTimeZoneDateParts,
	getTimeZoneDayRange,
	getTomorrowTimeZoneDayRange
} from "./lib/reminderScheduleTime";
import { sendPackageExpiryReminderEmail, sendPackagePaymentReminderEmail } from "./lib/email";
import { getCapacityConsumingPackageBookings } from "./lib/packageScheduling";

const REMINDER_BATCH_SIZE = 50;
const SYDNEY_TIME_ZONE = "Australia/Sydney";
const MORNING_REMINDER_HOUR = 9;
const AFTERNOON_REMINDER_HOUR = 12;
const EVENING_REMINDER_HOUR = 15;
const AFTERNOON_START_HOUR = 12;
const EVENING_START_HOUR = 16;
const REMINDER_HOURS = [MORNING_REMINDER_HOUR, AFTERNOON_REMINDER_HOUR, EVENING_REMINDER_HOUR];

const getReminderHourForBooking = (sessionStartAt: number) => {
	const { hour } = getTimeZoneDateParts(new Date(sessionStartAt), SYDNEY_TIME_ZONE);

	if (hour < AFTERNOON_START_HOUR) {
		return MORNING_REMINDER_HOUR;
	}

	if (hour < EVENING_START_HOUR) {
		return AFTERNOON_REMINDER_HOUR;
	}

	return EVENING_REMINDER_HOUR;
};

const MAX_PACKAGE_SESSIONS = 12;
const PAYMENT_REMINDER_DAYS_BEFORE_DUE = 2;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

type PackageReminderType = "payment" | "expiry";

function hasSentPackageReminder(
	reminderState: Doc<"multiBookingPackages">["packageReminderState"],
	reminderType: PackageReminderType
) {
	return reminderState?.type === reminderType && reminderState.status === "sent";
}

export const listPackagesDueForPaymentReminder = internalQuery({
	args: { invoiceDueStart: v.number(), invoiceDueEnd: v.number(), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const limit = args.limit ?? REMINDER_BATCH_SIZE;
		const packagesByStatus = await Promise.all(
			(["pending_payment", "invoice_email_failed"] as const).map((status) =>
				ctx.db
					.query("multiBookingPackages")
					.withIndex("by_status_and_invoiceDueAt", (query) =>
						query
							.eq("status", status)
							.gte("invoiceDueAt", args.invoiceDueStart)
							.lt("invoiceDueAt", args.invoiceDueEnd)
					)
					.take(limit)
			)
		);

		return packagesByStatus
			.flat()
			.filter(
				(multiBookingPackage) =>
					!hasSentPackageReminder(multiBookingPackage.packageReminderState, "payment")
			)
			.slice(0, limit);
	}
});

export const listPackagesPotentiallyDueForExpiryReminder = internalQuery({
	args: { expiresAfter: v.number(), expiresBefore: v.number(), limit: v.optional(v.number()) },
	handler: async (ctx, args) => {
		const limit = args.limit ?? REMINDER_BATCH_SIZE;
		const packagesByStatus = await Promise.all(
			(["paid", "schedule_email_failed"] as const).map((status) =>
				ctx.db
					.query("multiBookingPackages")
					.withIndex("by_status_and_expiresAt", (query) =>
						query
							.eq("status", status)
							.gt("expiresAt", args.expiresAfter)
							.lt("expiresAt", args.expiresBefore)
					)
					.take(limit)
			)
		);
		const eligiblePackages = packagesByStatus
			.flat()
			.filter(
				(multiBookingPackage) =>
					!hasSentPackageReminder(multiBookingPackage.packageReminderState, "expiry")
			)
			.slice(0, limit);

		return await Promise.all(
			eligiblePackages.map(async (multiBookingPackage) => ({
				...multiBookingPackage,
				remainingSessions:
					multiBookingPackage.packageSize -
					(
						await getCapacityConsumingPackageBookings(
							ctx,
							multiBookingPackage._id,
							multiBookingPackage.packageSize
						)
					).length
			}))
		);
	}
});

export const claimPackageReminder = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		reminderType: v.union(v.literal("payment"), v.literal("expiry")),
		now: v.number()
	},
	handler: async (ctx, args) => {
		const multiBookingPackage = await ctx.db.get(args.multiBookingId);
		if (!multiBookingPackage) return err({ reason: "PACKAGE_NOT_FOUND" });

		switch (args.reminderType) {
			case "payment":
				if (
					multiBookingPackage.status !== "pending_payment" &&
					multiBookingPackage.status !== "invoice_email_failed"
				) {
					return err({ reason: "PACKAGE_PAYMENT_REMINDER_NOT_SENDABLE" });
				}
				break;
			case "expiry":
				if (
					multiBookingPackage.status !== "paid" &&
					multiBookingPackage.status !== "schedule_email_failed"
				) {
					return err({ reason: "PACKAGE_EXPIRY_REMINDER_NOT_SENDABLE" });
				}
				break;
			default: {
				const _exhaustive: never = args.reminderType;
				return _exhaustive;
			}
		}

		const reminderState = multiBookingPackage.packageReminderState;
		if (
			reminderState?.status === "claimed" ||
			hasSentPackageReminder(reminderState, args.reminderType)
		) {
			return err({ reason: "PACKAGE_REMINDER_ALREADY_CLAIMED_OR_SENT" });
		}

		await ctx.db.patch(args.multiBookingId, {
			packageReminderState: { type: args.reminderType, status: "claimed", claimedAt: args.now }
		});
		return ok({ multiBookingPackage });
	}
});

export const markPackageReminderSent = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		reminderType: v.union(v.literal("payment"), v.literal("expiry")),
		now: v.number()
	},
	handler: async (ctx, args) => {
		const multiBookingPackage = await ctx.db.get(args.multiBookingId);
		if (!multiBookingPackage) return err({ reason: "PACKAGE_NOT_FOUND" });

		await ctx.db.patch(args.multiBookingId, {
			packageReminderState: { type: args.reminderType, status: "sent", sentAt: args.now }
		});

		return ok({ updated: true });
	}
});

export const markPackageReminderFailed = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		reminderType: v.union(v.literal("payment"), v.literal("expiry")),
		failureCode: v.string()
	},
	handler: async (ctx, args) => {
		const multiBookingPackage = await ctx.db.get(args.multiBookingId);
		if (!multiBookingPackage) return err({ reason: "PACKAGE_NOT_FOUND" });

		await ctx.db.patch(args.multiBookingId, {
			packageReminderState: {
				type: args.reminderType,
				status: "failed",
				failureCode: args.failureCode
			}
		});

		return ok({ updated: true });
	}
});

const getSydneyCalendarDayNumber = (timestamp: number) => {
	const { year, month, day } = getTimeZoneDateParts(new Date(timestamp), SYDNEY_TIME_ZONE);
	return Date.UTC(year, month - 1, day) / MS_PER_DAY;
};

async function sendPackagePaymentRemindersDueToday(ctx: ActionCtx, nowDate: Date) {
	const now = nowDate.getTime();
	const paymentDueDay = getTimeZoneDayRange(
		nowDate,
		SYDNEY_TIME_ZONE,
		PAYMENT_REMINDER_DAYS_BEFORE_DUE
	);
	const paymentPackages = await ctx.runQuery(internal.reminders.listPackagesDueForPaymentReminder, {
		invoiceDueEnd: paymentDueDay.dayEnd,
		invoiceDueStart: paymentDueDay.dayStart,
		limit: REMINDER_BATCH_SIZE
	});

	for (const packageRecord of paymentPackages) {
		const [claimError] = await ctx.runMutation(internal.reminders.claimPackageReminder, {
			multiBookingId: packageRecord._id,
			now,
			reminderType: "payment"
		});
		if (claimError !== null) {
			continue;
		}

		const [sendError] = await tryCatch(
			sendPackagePaymentReminderEmail({
				email: packageRecord.email,
				invoiceDueAt: packageRecord.invoiceDueAt,
				name: packageRecord.name,
				requestDate: packageRecord.createdAt
			})
		);
		if (sendError === null) {
			await ctx.runMutation(internal.reminders.markPackageReminderSent, {
				multiBookingId: packageRecord._id,
				now,
				reminderType: "payment"
			});
			continue;
		}

		await ctx.runMutation(internal.reminders.markPackageReminderFailed, {
			failureCode: sendError.reason,
			multiBookingId: packageRecord._id,
			reminderType: "payment"
		});
	}
}

async function sendPackageExpiryRemindersDueToday(ctx: ActionCtx, nowDate: Date) {
	const now = nowDate.getTime();
	const today = getTimeZoneDayRange(nowDate, SYDNEY_TIME_ZONE);
	const expiryRange = getTimeZoneDayRange(nowDate, SYDNEY_TIME_ZONE, MAX_PACKAGE_SESSIONS * 7);
	const expiryPackages = await ctx.runQuery(
		internal.reminders.listPackagesPotentiallyDueForExpiryReminder,
		{ expiresAfter: today.dayStart, expiresBefore: expiryRange.dayEnd, limit: REMINDER_BATCH_SIZE }
	);

	for (const packageRecord of expiryPackages) {
		const { expiresAt, remainingSessions } = packageRecord;
		if (
			expiresAt === undefined ||
			remainingSessions === 0 ||
			getSydneyCalendarDayNumber(expiresAt) - getSydneyCalendarDayNumber(now) !==
				remainingSessions * 7
		) {
			continue;
		}

		const [claimError] = await ctx.runMutation(internal.reminders.claimPackageReminder, {
			multiBookingId: packageRecord._id,
			now,
			reminderType: "expiry"
		});
		if (claimError !== null) {
			continue;
		}

		const [sendError] = await tryCatch(
			sendPackageExpiryReminderEmail({
				email: packageRecord.email,
				expiresAt,
				name: packageRecord.name,
				remainingSessions
			})
		);
		if (sendError === null) {
			await ctx.runMutation(internal.reminders.markPackageReminderSent, {
				multiBookingId: packageRecord._id,
				now,
				reminderType: "expiry"
			});
			continue;
		}

		await ctx.runMutation(internal.reminders.markPackageReminderFailed, {
			failureCode: sendError.reason,
			multiBookingId: packageRecord._id,
			reminderType: "expiry"
		});
	}
}

export const sendDueReminderEmails = internalAction({
	args: {},
	handler: async (ctx) => {
		const nowDate = new Date();
		const currentSydneyHour = getTimeZoneDateParts(nowDate, SYDNEY_TIME_ZONE).hour;

		if (!REMINDER_HOURS.includes(currentSydneyHour)) {
			return null;
		}

		if (currentSydneyHour === MORNING_REMINDER_HOUR) {
			await sendPackagePaymentRemindersDueToday(ctx, nowDate);
			await sendPackageExpiryRemindersDueToday(ctx, nowDate);
		}

		const { dayEnd, dayStart } = getTomorrowTimeZoneDayRange(nowDate, SYDNEY_TIME_ZONE);
		const bookings = await ctx.runQuery(internal.bookings.listBookingsDueForReminderEmail, {
			dayEnd,
			dayStart,
			limit: REMINDER_BATCH_SIZE
		});

		for (const booking of bookings) {
			if (getReminderHourForBooking(booking.sessionStartAt) !== currentSydneyHour) {
				continue;
			}

			await ctx.runAction(internal.googleCalendar.sendBookingReminderEmailForBooking, {
				bookingId: booking._id
			});
		}

		return null;
	}
});
