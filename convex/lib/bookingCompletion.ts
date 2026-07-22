import type { Result } from "../../src/lib/result";
import { createRescheduleUrlForBooking } from "../bookingReschedule";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import type { BookingAvailabilitySettings } from "./bookingCalendarTime";
import type { getGoogleCalendarClient } from "./googleCalendarClient";
import { sendBookingInvoiceEmailsForBooking } from "./email";
import type { BookingReservation } from "./bookingReservations";

type MarkBookingCompletedResult = Result<
	{ updated: true },
	{ reason: "BOOKING_NOT_FOUND" } | { reason: "BOOKING_RESERVATION_MISMATCH" }
>;

async function removeOrphanedBookingCalendarEvent(
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
		console.error("Orphaned booking Calendar event cleanup failed", {
			bookingId,
			googleEventId,
			error
		});
	}
}

export async function saveCompletedBooking(
	ctx: ActionCtx,
	booking: Doc<"bookings">,
	calendarClient: ReturnType<typeof getGoogleCalendarClient>,
	reservation: BookingReservation,
	googleEventId: string | undefined
) {
	const [completionError]: MarkBookingCompletedResult = await ctx.runMutation(
		internal.bookings.markBookingCompleted,
		{
			bookingId: booking._id,
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
		await removeOrphanedBookingCalendarEvent(booking._id, calendarClient, googleEventId);
	}

	return false;
}

export async function sendCompletedBookingInvoice(
	ctx: ActionCtx,
	booking: Doc<"bookings">,
	settings: BookingAvailabilitySettings
) {
	// Known edge case: see sendBookingInvoiceForBookingHandler in convex/googleCalendar.ts.
	const [linkError, rescheduleUrl] = await createRescheduleUrlForBooking(ctx, booking);

	if (linkError !== null) {
		console.error("Booking invoice reschedule link create failed", {
			bookingId: booking._id,
			reason: linkError.reason
		});
		await ctx.runMutation(internal.bookings.markBookingInvoiceEmailFailed, {
			bookingId: booking._id
		});
		return;
	}

	const [emailError] = await sendBookingInvoiceEmailsForBooking(booking, {
		leadTimeMinutes: settings.leadTimeMinutes,
		rescheduleUrl
	});

	if (emailError !== null) {
		console.error("Booking invoice email failed during booking completion", {
			bookingId: booking._id,
			reason: emailError.reason
		});
		await ctx.runMutation(internal.bookings.markBookingInvoiceEmailFailed, {
			bookingId: booking._id
		});
	}
}
