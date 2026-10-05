import type { UserIdentity } from "convex/server";
import type { Doc, Id } from "#convex/_generated/dataModel";
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

type DeliverablesAccess = { identity: UserIdentity; session: Doc<"bookings"> };

function writeInstagramHandleStep(ctx: MutationCtx, instagramHandle: string) {
	return (session: Doc<"bookings">) => writeSessionInstagramHandle(ctx, session, instagramHandle);
}

function loadSessionAfterPermissionStep(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return () => getSessionFromDb(ctx, bookingId);
}

function assignEditorStep(
	ctx: MutationCtx,
	editorTokenIdentifier: string | null,
	adminNotes: string
) {
	return (session: Doc<"bookings">) =>
		updateSessionEditorAssignment(ctx, session, editorTokenIdentifier, adminNotes);
}

function setArchivedStep(ctx: MutationCtx, bookingId: Id<"bookings">, archived: boolean) {
	return () => setBookingArchived(ctx, bookingId, archived);
}

function saveAdminNotesStep(ctx: MutationCtx, adminNotes: string) {
	return (session: Doc<"bookings">) => saveSessionAdminNotes(ctx, session, adminNotes);
}

function pairIdentityWithSessionStep(identity: UserIdentity) {
	return (session: Doc<"bookings">) => ({ identity, session });
}

function loadDeliverablesAccessStep(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return (identity: UserIdentity) =>
		getSessionFromDb(ctx, bookingId).map(pairIdentityWithSessionStep(identity));
}

function retainValueStep<T>(value: T) {
	return () => value;
}

function retainDeliverablesAccessStep(access: DeliverablesAccess) {
	return requireDeliverablesEligibility(access).map(retainValueStep(access));
}

function saveEditorNotesFromAccessStep(ctx: MutationCtx, editorNotes: string) {
	return ({ session }: DeliverablesAccess) => saveSessionEditorNotes(ctx, session, editorNotes);
}

function writeEditStatusFromAccessStep(
	ctx: MutationCtx,
	editStatus: "to_edit" | "editing" | "review" | "completed"
) {
	return (access: DeliverablesAccess) =>
		writeSessionEditStatusWithHostNotification(ctx, access, editStatus);
}

function archiveCancelledSessionStep(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return () =>
		archiveDeadCheckoutBooking(ctx, bookingId, {
			bookingFailureCode: undefined,
			googleCalendarId: undefined,
			googleEventId: undefined,
			status: "cancelled"
		});
}

export function saveSessionInstagramHandleByStripeSessionId(
	ctx: MutationCtx,
	args: { stripeSessionId: string; instagramHandle: string }
) {
	return getSessionByStripeSessionId(ctx, args.stripeSessionId)
		.andThen(requireConfirmedBookingSession)
		.andThen(writeInstagramHandleStep(ctx, args.instagramHandle));
}

export function assignSessionEditorFromAdmin(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string | null; adminNotes: string }
) {
	return requirePermission(ctx, "assign:session-editor")
		.andThen(loadSessionAfterPermissionStep(ctx, args.bookingId))
		.andThen(assignEditorStep(ctx, args.editorTokenIdentifier, args.adminNotes));
}

export function archiveSessionFromAdmin(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; archived: boolean }
) {
	return requirePermission(ctx, "archive:sessions")
		.andThen(loadSessionAfterPermissionStep(ctx, args.bookingId))
		.andThen(setArchivedStep(ctx, args.bookingId, args.archived));
}

export function writeSessionAdminNotesFromAdmin(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; adminNotes: string }
) {
	return requirePermission(ctx, "assign:session-editor")
		.andThen(loadSessionAfterPermissionStep(ctx, args.bookingId))
		.andThen(saveAdminNotesStep(ctx, args.adminNotes));
}

export function writeSessionEditorNotesFromEditor(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorNotes: string }
) {
	return requirePermission(ctx, "update:deliverables")
		.andThen(loadDeliverablesAccessStep(ctx, args.bookingId))
		.andThen(requireDeliverablesOwnership)
		.andThen(saveEditorNotesFromAccessStep(ctx, args.editorNotes));
}

export function writeSessionEditStatusFromEditor(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editStatus: "to_edit" | "editing" | "review" | "completed" }
) {
	return requirePermission(ctx, "update:deliverables")
		.andThen(loadDeliverablesAccessStep(ctx, args.bookingId))
		.andThen(requireDeliverablesOwnership)
		.andThen(retainDeliverablesAccessStep)
		.andThen(writeEditStatusFromAccessStep(ctx, args.editStatus));
}

export function cancelSessionAfterCalendarEventDeleted(
	ctx: MutationCtx,
	bookingId: Id<"bookings">
) {
	return getSessionFromDb(ctx, bookingId).andThen(archiveCancelledSessionStep(ctx, bookingId));
}
