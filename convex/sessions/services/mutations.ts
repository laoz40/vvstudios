import type { UserIdentity } from "convex/server";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { setBookingArchived } from "#convex/shared/lib/archiveState";
import { updateSessionEditorAssignment } from "#convex/sessions/services/editorAssignment";
import {
	requireDeliverablesEligibility,
	requireDeliverablesOwnership,
	saveSessionAdminNotes,
	saveSessionEditorNotes
} from "#convex/editor/lib/editorSessions";
import { archiveDeadCheckoutBooking } from "#convex/sessions/services/archive";
import type { DeliverablesAccess } from "#convex/sessions/lib/adminMutations";
import { getSessionByStripeSessionId, getSessionFromDb } from "#convex/sessions/services/lookup";
import { requirePermission } from "#convex/shared/services/auth";
import { requireConfirmedBookingSession } from "#convex/sessions/lib/adminList";
import { writeSessionEditStatusWithHostNotification } from "#convex/sessions/services/deliverables";
import { writeSessionInstagramHandle } from "#convex/sessions/services/adminList";

function loadDeliverablesAccessStep(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	identity: UserIdentity
) {
	return getSessionFromDb(ctx, bookingId).map((session: Doc<"bookings">) => ({
		identity,
		session
	}));
}

export function saveSessionInstagramHandleByStripeSessionId(
	ctx: MutationCtx,
	args: { stripeSessionId: string; instagramHandle: string }
) {
	return getSessionByStripeSessionId(ctx, args.stripeSessionId)
		.andThen(requireConfirmedBookingSession)
		.andThen((session: Doc<"bookings">) =>
			writeSessionInstagramHandle(ctx, session, args.instagramHandle)
		);
}

export function assignSessionEditorFromAdmin(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string | null; adminNotes: string }
) {
	return requirePermission(ctx, "assign:session-editor")
		.andThen(() => getSessionFromDb(ctx, args.bookingId))
		.andThen((session: Doc<"bookings">) =>
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
		.andThen((session: Doc<"bookings">) => saveSessionAdminNotes(ctx, session, args.adminNotes));
}

export function writeSessionEditorNotesFromEditor(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorNotes: string }
) {
	return requirePermission(ctx, "update:deliverables")
		.andThen((identity: UserIdentity) => loadDeliverablesAccessStep(ctx, args.bookingId, identity))
		.andThen(requireDeliverablesOwnership)
		.andThen(({ session }) => saveSessionEditorNotes(ctx, session, args.editorNotes));
}

export function writeSessionEditStatusFromEditor(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editStatus: "to_edit" | "editing" | "review" | "completed" }
) {
	return requirePermission(ctx, "update:deliverables")
		.andThen((identity: UserIdentity) => loadDeliverablesAccessStep(ctx, args.bookingId, identity))
		.andThen(requireDeliverablesOwnership)
		.andThen((access) => requireDeliverablesEligibility(access).map(() => access))
		.andThen((access: DeliverablesAccess) =>
			writeSessionEditStatusWithHostNotification(ctx, access, args.editStatus)
		);
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
