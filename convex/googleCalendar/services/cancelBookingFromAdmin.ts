"use node";

import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/shared/services/requirePermissionActions";
import { clearCancelledSessionDriveFields } from "#convex/drive/services/cleanupCancelledSessionDrive";
import { loadGoogleCalendarClient } from "#convex/googleCalendar/lib/googleCalendarClient";
import { deleteSessionCalendarEvent } from "#convex/googleCalendar/services/calendarEvent";
import type { GoogleCalendarEventClient } from "#convex/sessions/lib/calendarEventPayload";
import type { Doc } from "#convex/_generated/dataModel";
import { getSessionFromQuery } from "#convex/sessions/services/lookup";
import { fromConvexTuple } from "#convex/shared/lib/result";
import type { CancelBookingFromAdminError } from "#convex/googleCalendar/services/calendar";

export function requireCancelSessionsPermission(ctx: ActionCtx) {
	return requirePermissionActions(ctx, "cancel:sessions");
}

function adminCancelCalendarClientWithSessionStep(
	session: Doc<"bookings">,
	client: Parameters<typeof deleteSessionCalendarEvent>[0]["client"]
) {
	return { client, session };
}

function adminCancelCalendarClientWithSession(session: Doc<"bookings">) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_DELETE_FAILED").map(
		(client: Parameters<typeof deleteSessionCalendarEvent>[0]["client"]) =>
			adminCancelCalendarClientWithSessionStep(session, client)
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
	return fromConvexTuple(
		ctx.runMutation(internal.sessions.admin.markSessionCalendarEventDeleted, { bookingId })
	);
}

function adminCancelCleanupResult() {
	return { cancelled: true as const };
}

export function cleanupAdminCancelledBookingDrive(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return clearCancelledSessionDriveFields(ctx, { bookingId }).map(adminCancelCleanupResult);
}

export type { CancelBookingFromAdminError };
