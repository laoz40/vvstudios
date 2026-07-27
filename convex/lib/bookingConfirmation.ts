import type { Result } from "../../src/lib/result";
import { createRescheduleUrlForSession } from "../sessionReschedule";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type { SessionAvailabilitySettings } from "./sessionCalendarTime";
import type { getGoogleCalendarClient } from "./googleCalendarClient";
import { sendBookingInvoiceEmailsForBooking } from "./email";
import type { SessionReservation } from "./sessionReservations";

type MarkBookingConfirmedResult = Result<
	{ updated: true },
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

	// This attempt no longer owns the reservation, so remove its untracked Calendar event.
	if (googleEventId) {
		await removeOrphanedSessionCalendarEvent(session._id, calendarClient, googleEventId);
	}

	return false;
}

export async function sendConfirmedBookingInvoice(
	ctx: ActionCtx,
	session: Doc<"bookings">,
	settings: SessionAvailabilitySettings
) {
	// Known edge case: see sendBookingInvoiceForBookingHandler in convex/googleCalendar.ts.
	const [linkError, rescheduleUrl] = await createRescheduleUrlForSession(ctx, session);

	if (linkError !== null) {
		console.error("Booking invoice reschedule link create failed", {
			bookingId: session._id,
			reason: linkError.reason
		});
		await ctx.runMutation(internal.bookingConfirmation.markSessionInvoiceEmailFailed, {
			bookingId: session._id
		});
		return;
	}

	const [emailError] = await sendBookingInvoiceEmailsForBooking(session, {
		leadTimeMinutes: settings.leadTimeMinutes,
		rescheduleUrl
	});

	if (emailError !== null) {
		console.error("Booking invoice email failed during booking confirmation", {
			bookingId: session._id,
			reason: emailError.reason
		});
		await ctx.runMutation(internal.bookingConfirmation.markSessionInvoiceEmailFailed, {
			bookingId: session._id
		});
	}
}
