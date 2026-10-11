"use node";

import type { Id, Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/shared/services/requirePermissionActions";
import { clearCancelledSessionDriveFields } from "#convex/drive/services/cleanupCancelledSessionDrive";
import { loadGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";
import { markBookingSessionCalendarDeleted as markBookingSessionCalendarDeletedStep } from "#convex/googleCalendar/lib/cancelBookingFromAdmin";
import { deleteSessionCalendarEvent } from "#convex/googleCalendar/services/calendarEvent";
import type { GoogleCalendarEventClient } from "#convex/sessions/lib/calendarEventPayload";
import { getSessionFromQuery } from "#convex/sessions/services/lookup";
import type { CancelBookingFromAdminError } from "#convex/googleCalendar/services/calendar";

export function requireCancelSessionsPermission(ctx: ActionCtx) {
	return requirePermissionActions(ctx, "cancel:sessions");
}

function adminCancelCalendarClientWithSession(session: Doc<"bookings">) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_DELETE_FAILED").map(
		(client: Parameters<typeof deleteSessionCalendarEvent>[0]["client"]) => ({ client, session })
	);
}

export function loadAdminCancelSession(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return getSessionFromQuery(ctx, bookingId).andThen(adminCancelCalendarClientWithSession);
}

export function deleteAdminBookingCalendarEvent({
	client,
	session
}: {
	client: GoogleCalendarEventClient;
	session: Doc<"bookings">;
}) {
	return deleteSessionCalendarEvent({ session, client });
}

export function markBookingSessionCalendarDeleted(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return markBookingSessionCalendarDeletedStep(ctx, bookingId);
}

export function cleanupAdminCancelledBookingDrive(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return clearCancelledSessionDriveFields(ctx, { bookingId }).map(() => ({
		cancelled: true as const
	}));
}

export type { CancelBookingFromAdminError };
