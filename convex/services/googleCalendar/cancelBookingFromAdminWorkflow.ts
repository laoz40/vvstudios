"use node";

import { internal } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { requirePermissionActions } from "#convex/services/auth";
import { cleanupCancelledSessionDriveService } from "#convex/services/drive/cleanupCancelledSessionDrive";
import { loadGoogleCalendarClient } from "#convex/lib/googleCalendar/googleCalendarClient";
import { deleteSessionCalendarEvent } from "#convex/services/googleCalendar/sessionCalendarEventWorkflow";
import type { GoogleCalendarEventClient } from "#convex/lib/sessions/sessionCalendarEventPayload";
import type { Doc } from "#convex/_generated/dataModel";
import { getSessionFromQuery } from "#convex/lib/sessions/sessionLookup";
import { fromConvexTuple } from "#convex/lib/result";
import type { CancelBookingFromAdminError } from "#convex/services/googleCalendar/sessionCalendar";

export function requireCancelSessionsPermission(ctx: ActionCtx) {
	return requirePermissionActions(ctx, "cancel:sessions");
}

export function loadAdminCancelSession(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return getSessionFromQuery(ctx, bookingId).andThen((session) =>
		loadGoogleCalendarClient("GOOGLE_CALENDAR_DELETE_FAILED").map((client) => ({ client, session }))
	);
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

export function cleanupAdminCancelledBookingDrive(ctx: ActionCtx, bookingId: Id<"bookings">) {
	return cleanupCancelledSessionDriveService(ctx, { bookingId }).map(() => ({
		cancelled: true as const
	}));
}

export type { CancelBookingFromAdminError };
