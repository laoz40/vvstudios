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
import { getSessionByStripeSessionId, getSessionFromDb } from "#convex/sessions/services/lookup";
import { requirePermission } from "#convex/shared/services/auth";
import { writeSessionEditStatusWithHostNotification } from "#convex/sessions/services/deliverables";
import {
	requireConfirmedBookingSession,
	writeSessionInstagramHandle
} from "#convex/sessions/services/adminList";

type DeliverablesAccess = { identity: UserIdentity; session: Doc<"bookings"> };

function writeInstagramHandleStep(
	ctx: MutationCtx,
	instagramHandle: string,
	session: Doc<"bookings">
) {
	return writeSessionInstagramHandle(ctx, session, instagramHandle);
}

function loadSessionAfterPermissionStep(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return getSessionFromDb(ctx, bookingId);
}

function assignEditorStep(
	ctx: MutationCtx,
	editorTokenIdentifier: string | null,
	adminNotes: string,

	session: Doc<"bookings">
) {
	return updateSessionEditorAssignment(ctx, session, editorTokenIdentifier, adminNotes);
}

function setArchivedStep(ctx: MutationCtx, bookingId: Id<"bookings">, archived: boolean) {
	return setBookingArchived(ctx, bookingId, archived);
}

function saveAdminNotesStep(ctx: MutationCtx, adminNotes: string, session: Doc<"bookings">) {
	return saveSessionAdminNotes(ctx, session, adminNotes);
}

function pairIdentityWithSessionStep(identity: UserIdentity, session: Doc<"bookings">) {
	return { identity, session };
}

function loadDeliverablesAccessStep(
	ctx: MutationCtx,
	bookingId: Id<"bookings">,
	identity: UserIdentity
) {
	return getSessionFromDb(ctx, bookingId).map((session: Doc<"bookings">) =>
		pairIdentityWithSessionStep(identity, session)
	);
}

function retainValueStep<T>(value: T) {
	return value;
}

function retainDeliverablesAccessStep(access: DeliverablesAccess) {
	return requireDeliverablesEligibility(access).map(() => retainValueStep(access));
}

function saveEditorNotesFromAccessStep(
	ctx: MutationCtx,
	editorNotes: string,
	{ session }: DeliverablesAccess
) {
	return saveSessionEditorNotes(ctx, session, editorNotes);
}

function writeEditStatusFromAccessStep(
	ctx: MutationCtx,
	editStatus: "to_edit" | "editing" | "review" | "completed",

	access: DeliverablesAccess
) {
	return writeSessionEditStatusWithHostNotification(ctx, access, editStatus);
}

function archiveCancelledSessionStep(ctx: MutationCtx, bookingId: Id<"bookings">) {
	return archiveDeadCheckoutBooking(ctx, bookingId, {
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
		.andThen((session: Doc<"bookings">) =>
			writeInstagramHandleStep(ctx, args.instagramHandle, session)
		);
}

export function assignSessionEditorFromAdmin(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string | null; adminNotes: string }
) {
	return requirePermission(ctx, "assign:session-editor")
		.andThen(() => loadSessionAfterPermissionStep(ctx, args.bookingId))
		.andThen((session: Doc<"bookings">) =>
			assignEditorStep(ctx, args.editorTokenIdentifier, args.adminNotes, session)
		);
}

export function archiveSessionFromAdmin(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; archived: boolean }
) {
	return requirePermission(ctx, "archive:sessions")
		.andThen(() => loadSessionAfterPermissionStep(ctx, args.bookingId))
		.andThen(() => setArchivedStep(ctx, args.bookingId, args.archived));
}

export function writeSessionAdminNotesFromAdmin(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; adminNotes: string }
) {
	return requirePermission(ctx, "assign:session-editor")
		.andThen(() => loadSessionAfterPermissionStep(ctx, args.bookingId))
		.andThen((session: Doc<"bookings">) => saveAdminNotesStep(ctx, args.adminNotes, session));
}

export function writeSessionEditorNotesFromEditor(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorNotes: string }
) {
	return requirePermission(ctx, "update:deliverables")
		.andThen((identity: UserIdentity) => loadDeliverablesAccessStep(ctx, args.bookingId, identity))
		.andThen(requireDeliverablesOwnership)
		.andThen((_value) => saveEditorNotesFromAccessStep(ctx, args.editorNotes, _value));
}

export function writeSessionEditStatusFromEditor(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editStatus: "to_edit" | "editing" | "review" | "completed" }
) {
	return requirePermission(ctx, "update:deliverables")
		.andThen((identity: UserIdentity) => loadDeliverablesAccessStep(ctx, args.bookingId, identity))
		.andThen(requireDeliverablesOwnership)
		.andThen(retainDeliverablesAccessStep)
		.andThen((access: DeliverablesAccess) =>
			writeEditStatusFromAccessStep(ctx, args.editStatus, access)
		);
}

export function cancelSessionAfterCalendarEventDeleted(
	ctx: MutationCtx,
	bookingId: Id<"bookings">
) {
	return getSessionFromDb(ctx, bookingId).andThen(() =>
		archiveCancelledSessionStep(ctx, bookingId)
	);
}
