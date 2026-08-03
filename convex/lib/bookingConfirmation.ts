"use node";

import { okAsync, ResultAsync } from "neverthrow";
import type { Result } from "#/lib/result";
import { createRescheduleUrlForSession } from "#convex/sessionReschedule";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { sendBookingInvoiceEmailsForBooking, sendSessionReminderEmail } from "#convex/lib/email";
import { getGoogleCalendarClient } from "#convex/lib/googleCalendarClient";
import {
	buildEventWindow,
	type SessionAvailabilitySettings
} from "#convex/lib/sessionCalendarTime";
import type { SessionReservation } from "#convex/lib/sessionReservations";

function getReminderRescheduleUrl(ctx: ActionCtx, session: Doc<"bookings">) {
	if (session.multiBookingPackageId !== undefined) {
		return okAsync<string | undefined>(undefined);
	}

	return createRescheduleUrlForSession(ctx, session).map(
		(rescheduleUrl): string | undefined => rescheduleUrl
	);
}

export function sendBookingReminderEmailForSession(ctx: ActionCtx, session: Doc<"bookings">) {
	const { timeZone } = getGoogleCalendarClient();

	return buildEventWindow(session.date, session.time, session.duration, timeZone).asyncAndThen(
		({ startDateTime }) =>
			getReminderRescheduleUrl(ctx, session).andThen((rescheduleUrl) =>
				ResultAsync.fromSafePromise(
					sendSessionReminderEmail({
						name: session.name,
						email: session.email,
						date: session.date,
						startDateTime,
						time: session.time,
						timeZone,
						service: session.service,
						duration: session.duration,
						addons: session.addons,
						rescheduleUrl,
						isPackageSession: session.multiBookingPackageId !== undefined
					})
				)
					.andThen((emailResult) => emailResult)
					.mapErr((emailError) => {
						console.error("Booking reminder email send failed", {
							bookingId: session._id,
							bookingEmail: session.email,
							reason: emailError.reason
						});
						return { reason: "RESEND_SEND_FAILED" as const };
					})
			)
	);
}

type MarkBookingConfirmedResult = Result<
	null,
	{ reason: "BOOKING_NOT_FOUND" } | { reason: "BOOKING_RESERVATION_MISMATCH" }
>;

async function removeOrphanedSessionCalendarEvent(
	bookingId: Id<"bookings">,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>,
	googleEventId: string
) {
	try {
		await calendarClient.calendar.events.delete({
			calendarId: calendarClient.calendarId,
			eventId: googleEventId,
			sendUpdates: "all"
		});
	} catch (error) {
		console.error("Orphaned session Calendar event cleanup failed", {
			bookingId,
			googleEventId,
			error
		});
	}
}

export async function saveConfirmedBooking(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>,
	reservation: SessionReservation,
	googleEventId: string | undefined
) {
	const [completionError]: MarkBookingConfirmedResult = await ctx.runMutation(
		internal.bookingConfirmation.markBookingConfirmed,
		{
			bookingId: session._id,
			googleEventId,
			googleCalendarId: calendarClient.calendarId,
			reservation
		}
	);

	if (completionError === null) {
		return true;
	}

	switch (completionError.reason) {
		case "BOOKING_NOT_FOUND":
			console.error("Booking disappeared before confirmation completed", {
				bookingId: session._id
			});
			break;
		case "BOOKING_RESERVATION_MISMATCH":
			console.error("Booking reservation changed before confirmation completed", {
				bookingId: session._id
			});
			break;
		default: {
			const _exhaustive: never = completionError;
			return _exhaustive;
		}
	}

	// Confirmation failed, so remove any Calendar event that was created but not recorded.
	if (googleEventId) {
		await removeOrphanedSessionCalendarEvent(session._id, calendarClient, googleEventId);
	}

	return false;
}

async function recordInvoiceEmailFailure(
	ctx: ActionCtx,
	{ bookingId, message, reason }: { bookingId: Id<"bookings">; message: string; reason: string }
) {
	console.error(message, { bookingId, reason });

	const [markFailedError] = await ctx.runMutation(
		internal.bookingConfirmation.markSessionInvoiceEmailFailed,
		{ bookingId }
	);

	if (markFailedError !== null) {
		console.error("Failed to record booking invoice email failure", {
			bookingId,
			reason: markFailedError.reason
		});
	}
}

export async function sendConfirmedBookingInvoice(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings
) {
	// Known edge case: see sendBookingInvoiceForBookingHandler in convex/googleCalendar.ts.
	const linkResult = await createRescheduleUrlForSession(ctx, session);

	if (linkResult.isErr()) {
		await recordInvoiceEmailFailure(ctx, {
			bookingId: session._id,
			message: "Booking invoice reschedule link create failed",
			reason: linkResult.error.reason
		});
		return;
	}

	const emailResult = await sendBookingInvoiceEmailsForBooking(session, {
		leadTimeMinutes: settings.leadTimeMinutes,
		rescheduleUrl: linkResult.value
	});

	if (emailResult.isErr()) {
		await recordInvoiceEmailFailure(ctx, {
			bookingId: session._id,
			message: "Booking invoice email failed during booking confirmation",
			reason: emailResult.error.reason
		});
	}
}
