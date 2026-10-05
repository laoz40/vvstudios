"use node";

import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/services/requirePermissionActions";
import { clearCancelledSessionDriveFields } from "#convex/services/drive/cleanupCancelledSessionDrive";
import { loadGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import { deleteSessionCalendarEvent } from "#convex/services/googleCalendar/sessionCalendarEvent";
import type { GoogleCalendarEventClient } from "#convex/lib/sessions/sessionCalendarEventPayload";
import type { Doc } from "#convex/_generated/dataModel";
import { getSessionFromQuery } from "#convex/services/sessions/sessionLookup";
import { fromConvexTuple } from "#convex/lib/result";
import type { CancelBookingFromAdminError } from "#convex/services/googleCalendar/sessionCalendar";

export function requireCancelSessionsPermission(ctx: ActionCtx) {
	return requirePermissionActions(ctx, "cancel:sessions");
}

function adminCancelCalendarClientWithSessionStep(session: Doc<"bookings">) {
	return (client: Parameters<typeof deleteSessionCalendarEvent>[0]["client"]) => ({
		client,
		session
	});
}

function adminCancelCalendarClientWithSession(session: Doc<"bookings">) {
	return loadGoogleCalendarClient("GOOGLE_CALENDAR_DELETE_FAILED").map(
		adminCancelCalendarClientWithSessionStep(session)
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
		ctx.runMutation(internal.sessions.markSessionCalendarEventDeleted, { bookingId })
	);
}

function adminCancelCleanupResult() {
	return { cancelled: true as const };
}

export function cleanupAdminCancelledBookingDrive(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return clearCancelledSessionDriveFields(ctx, { bookingId }).map(adminCancelCleanupResult);
}

export type { CancelBookingFromAdminError };
