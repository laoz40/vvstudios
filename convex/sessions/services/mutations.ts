import { ok, safeTry, type ResultAsync } from "neverthrow";
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
import { requireConfirmedBookingSession } from "#convex/sessions/lib/adminList";
import { writeSessionEditStatusWithHostNotification } from "#convex/sessions/services/deliverables";
import { writeSessionInstagramHandle } from "#convex/sessions/services/adminList";
import {
	loadEditorForAdminNotesNotification,
	scheduleAdminNotesEmail,
	scheduleEditorNotesEmail
} from "#convex/sessions/lib/notesNotification";

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
	return safeTry(async function* () {
		const session = yield* getSessionByStripeSessionId(ctx, args.stripeSessionId);
		const confirmedSession = yield* requireConfirmedBookingSession(session);

		return ok(yield* writeSessionInstagramHandle(ctx, confirmedSession, args.instagramHandle));
	});
}

export function assignSessionEditorFromAdmin(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorTokenIdentifier: string | null; adminNotes: string }
): ResultAsync<
	null,
	{
		reason:
			| "BOOKING_NOT_FOUND"
			| "EDITOR_NOT_ACTIVE"
			| "SESSION_NOT_ASSIGNABLE"
			| "NOT_AUTHENTICATED"
			| "NOT_AUTHORIZED";
	}
> {
	return safeTry(async function* () {
		yield* requirePermission(ctx, "assign:session-editor");
		const session = yield* getSessionFromDb(ctx, args.bookingId);

		return ok(
			yield* updateSessionEditorAssignment(
				ctx,
				session,
				args.editorTokenIdentifier,
				args.adminNotes
			)
		);
	});
}

export function archiveSessionFromAdmin(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; archived: boolean }
) {
	return safeTry(async function* () {
		yield* requirePermission(ctx, "archive:sessions");
		yield* getSessionFromDb(ctx, args.bookingId);

		return ok(yield* setBookingArchived(ctx, args.bookingId, args.archived));
	});
}

export function writeSessionAdminNotesFromAdmin(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; adminNotes: string }
) {
	return safeTry(async function* () {
		yield* requirePermission(ctx, "assign:session-editor");
		const session = yield* getSessionFromDb(ctx, args.bookingId);

		yield* saveSessionAdminNotes(ctx, session, args.adminNotes);
		const editor = yield* loadEditorForAdminNotesNotification(ctx, session, args.adminNotes);

		return ok(yield* scheduleAdminNotesEmail(ctx, session, args.adminNotes, editor));
	});
}

export function writeSessionEditorNotesFromEditor(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editorNotes: string }
) {
	return safeTry(async function* () {
		const identity = yield* requirePermission(ctx, "update:deliverables");
		const access = yield* loadDeliverablesAccessStep(ctx, args.bookingId, identity);
		const ownedAccess = yield* requireDeliverablesOwnership(access);

		yield* saveSessionEditorNotes(ctx, ownedAccess.session, args.editorNotes);

		return ok(yield* scheduleEditorNotesEmail(ctx, ownedAccess.session, args.editorNotes));
	});
}

export function writeSessionEditStatusFromEditor(
	ctx: MutationCtx,
	args: { bookingId: Id<"bookings">; editStatus: "to_edit" | "editing" | "review" | "completed" }
) {
	return safeTry(async function* () {
		const identity = yield* requirePermission(ctx, "update:deliverables");
		const access = yield* loadDeliverablesAccessStep(ctx, args.bookingId, identity);
		const ownedAccess = yield* requireDeliverablesOwnership(access);

		const eligibleAccess = yield* requireDeliverablesEligibility(ownedAccess).map(
			() => ownedAccess
		);

		return ok(
			yield* writeSessionEditStatusWithHostNotification(ctx, eligibleAccess, args.editStatus)
		);
	});
}

export function cancelSessionAfterCalendarEventDeleted(
	ctx: MutationCtx,
	bookingId: Id<"bookings">
) {
	return safeTry(async function* () {
		yield* getSessionFromDb(ctx, bookingId);

		return ok(
			yield* archiveDeadCheckoutBooking(ctx, bookingId, {
				bookingFailureCode: undefined,
				googleCalendarId: undefined,
				googleEventId: undefined,
				status: "cancelled"
			})
		);
	});
}
