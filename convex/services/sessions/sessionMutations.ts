import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { setBookingArchived } from "#convex/lib/archiveState";
import { updateSessionEditorAssignment } from "#convex/services/sessions/sessionEditorAssignment";
import {
	requireDeliverablesEligibility,
	requireDeliverablesOwnership,
	saveSessionAdminNotes,
	saveSessionEditorNotes
} from "#convex/lib/editor/editorSessions";
import { archiveDeadCheckoutBooking } from "#convex/services/sessions/sessionArchive";
import {
	getSessionByStripeSessionId,
	getSessionFromDb
} from "#convex/services/sessions/sessionLookup";
import { requirePermission } from "#convex/services/auth";
import { writeSessionEditStatusWithHostNotification } from "#convex/services/sessions/sessionDeliverables";
import {
	requireConfirmedBookingSession,
	writeSessionInstagramHandle
} from "#convex/services/sessions/sessions";

export function saveSessionInstagramHandleByStripeSessionId(
	ctx: MutationCtx,
	args: { stripeSessionId: string; instagramHandle: string }
) {
	return getSessionByStripeSessionId(ctx, args.stripeSessionId)
		.andThen(requireConfirmedBookingSession)
		.andThen((session) => writeSessionInstagramHandle(ctx, session, args.instagramHandle));
}

export function assignSessionEditorFromAdmin(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string | null; adminNotes: string }
) {
	return requirePermission(ctx, "assign:session-editor")
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen((session) =>
			updateSessionEditorAssignment(ctx, session, args.editorTokenIdentifier, args.adminNotes)
		);
}

export function archiveSessionFromAdmin(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; archived: boolean }
) {
	return requirePermission(ctx, "archive:sessions")
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen(() => setBookingArchived(ctx, args.bookingId, args.archived));
}

export function writeSessionAdminNotesFromAdmin(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; adminNotes: string }
) {
	return requirePermission(ctx, "assign:session-editor")
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen((session) => saveSessionAdminNotes(ctx, session, args.adminNotes));
}

export function writeSessionEditorNotesFromEditor(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorNotes: string }
) {
	return requirePermission(ctx, "update:deliverables")
		.andThen((identity) =>
			getSessionFromDb(ctx, args.bookingId).map((session) => ({ identity, session }))
		)
		.andThen(requireDeliverablesOwnership)
		.andThen(({ session }) => saveSessionEditorNotes(ctx, session, args.editorNotes));
}

export function writeSessionEditStatusFromEditor(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editStatus: "to_edit" | "editing" | "review" | "completed" }
) {
	return requirePermission(ctx, "update:deliverables")
		.andThen((identity) =>
			getSessionFromDb(ctx, args.bookingId).map((session) => ({ identity, session }))
		)
		.andThen(requireDeliverablesOwnership)
		.andThen((access) => requireDeliverablesEligibility(access).map(() => access))
		.andThen((access) => writeSessionEditStatusWithHostNotification(ctx, access, args.editStatus));
}

export function cancelSessionAfterCalendarEventDeleted(
	ctx: MutationCtx,
	bookingId: Id<"bookings">
) {
	return getSessionFromDb(ctx, bookingId).andThen(() =>
		archiveDeadCheckoutBooking(ctx, bookingId, {
			bookingFailureCode: undefined,
			googleCalendarId: undefined,
			googleEventId: undefined,
			status: "cancelled"
		})
	);
}
