import { err, ok, type Result as NeverthrowResult } from "neverthrow";
import type { Result } from "#/lib/result";
import { createRescheduleUrlForSession } from "#convex/sessionReschedule";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { ActionCtx, MutationCtx } from "#convex/_generated/server";
import type { SessionAvailabilitySettings } from "./sessionCalendarTime";
import type { getGoogleCalendarClient } from "./googleCalendarClient";
import { sendBookingInvoiceEmailsForBooking } from "./email";
import type { SessionReservation } from "./sessionReservations";

type BookingClaimStatus =
	| { kind: "already_confirmed" }
	| { kind: "already_claimed" }
	| { kind: "pending"; session: Doc<"bookings"> };

type BookingClaimStatusError =
	| { reason: "BOOKING_INVALID_STATUS"; status: "cancelled" | "abandoned" }
	| { reason: "BOOKING_EXPIRED" }
	| { reason: "BOOKING_FAILED" };

export function normalizeBookingId(ctx: MutationCtx, bookingId: string) {
	// Stripe metadata provides a plain string, so validate it before database access.
	const normalizedBookingId = ctx.db.normalizeId("bookings", bookingId);
	return normalizedBookingId
		? ok(normalizedBookingId)
		: err({ reason: "BOOKING_NOT_FOUND" as const });
}

export function validateClaimStripeSession(session: Doc<"bookings">, stripeSessionId: string) {
	if (session.stripeSessionId && session.stripeSessionId !== stripeSessionId) {
		return err({ reason: "STRIPE_SESSION_MISMATCH" as const });
	}

	return ok(session);
}

export function getBookingClaimStatus(
	session: Doc<"bookings">
): NeverthrowResult<BookingClaimStatus, BookingClaimStatusError> {
	switch (session.status) {
		case "confirmed":
		case "email_failed":
			return ok({ kind: "already_confirmed" });
		case "cancelled":
		case "abandoned":
			return err({ reason: "BOOKING_INVALID_STATUS", status: session.status });
		case "expired":
			return err({ reason: "BOOKING_EXPIRED" });
		case "failed":
			return err({ reason: "BOOKING_FAILED" });
		case "pending_payment":
			return session.bookingConfirmationClaimedAt
				? ok({ kind: "already_claimed" })
				: ok({ kind: "pending", session });
		default: {
			const _exhaustive: never = session.status;
			return _exhaustive;
		}
	}
}

export function buildClaimedBookingSession(session: Doc<"bookings">) {
	return {
		_id: session._id,
		name: session.name,
		phone: session.phone,
		accountName: session.accountName,
		abn: session.abn,
		email: session.email,
		date: session.date,
		time: session.time,
		duration: session.duration,
		service: session.service,
		addons: session.addons,
		notes: session.notes
	};
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
