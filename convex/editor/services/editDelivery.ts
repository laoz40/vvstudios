import type { UserIdentity } from "convex/server";
import { ok, safeTry } from "neverthrow";
import { EDIT_WORK_STATUSES, type EditWorkStatus } from "#/domain/booking/edit-status";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import type { Permission } from "#/lib/permissions";
import {
	saveDeliverablesEmailLock,
	loadEdit,
	patchEditStatus,
	saveDeliverablesEmailResult,
	authorizeEditDelivery,
	requireEditStatus,
	requireEditorIdentity,
	requireSessionEdit,
	type DeliverablesEmailRecipient,
	type DeliverablesEmailOutcome
} from "#convex/editor/lib/editDelivery";
import { getSessionStatusFromEdits, listEdits } from "#convex/editor/lib/edits";
import {
	requireDeliverablesEligibility,
	requireDeliverablesOwnership
} from "#convex/editor/lib/editorSessions";
import { saveSessionEditStatus } from "#convex/editor/services/sessionEditStatus";
import { archiveSessionWhenFullyDone } from "#convex/sessions/services/archive";
import { getSessionFromDb } from "#convex/sessions/services/lookup";
import { getEditorByToken, requirePermission } from "#convex/shared/services/auth";

type EditIdentity = { bookingId: Id<"bookings">; editId: Id<"edits"> };

function loadSessionEdit(ctx: MutationCtx, session: Doc<"bookings">, editId: Id<"edits">) {
	return safeTry(async function* () {
		const edit = yield* loadEdit(ctx, editId);

		return ok(yield* requireSessionEdit(session, edit));
	});
}

export function loadEditAccess(ctx: MutationCtx, args: EditIdentity, permission: Permission) {
	return safeTry(async function* () {
		const identity = yield* requirePermission(ctx, permission);
		const session = yield* getSessionFromDb(ctx, args.bookingId);
		const access = yield* requireDeliverablesOwnership({ identity, session });
		yield* requireDeliverablesEligibility(access);

		const edit = yield* loadSessionEdit(ctx, session, args.editId);

		return ok({ identity, session, edit });
	});
}

export function authorizeAndLockDeliverablesEmail(
	ctx: MutationCtx,
	access: { identity: UserIdentity; session: Doc<"bookings">; edit: Doc<"edits"> },
	args: { recipient: DeliverablesEmailRecipient; lockId: string }
) {
	return safeTry(async function* () {
		const editor = yield* getEditorByToken(ctx, access.identity.tokenIdentifier);

		const { editorName, previousDeliveryAt, allowedStatuses } = yield* authorizeEditDelivery(
			editor,
			access,
			args.recipient
		);

		yield* requireEditStatus(access.edit, allowedStatuses);
		yield* saveDeliverablesEmailLock(ctx, access.edit, args.lockId);

		return ok({ editorName, previousDeliveryAt });
	});
}

export function updateSessionStatusFromEdits(ctx: MutationCtx, session: Doc<"bookings">) {
	return safeTry(async function* () {
		const edits = yield* listEdits(ctx, session._id);
		const status = getSessionStatusFromEdits(edits);

		// Completing the session updates the editor's total and lets it leave the Inbox.
		yield* saveSessionEditStatus(ctx, session, status);
		yield* archiveSessionWhenFullyDone(ctx, status === "completed" ? session._id : null);

		return ok(null);
	});
}

export function saveEditingStatus(
	ctx: MutationCtx,
	access: { identity: UserIdentity; edit: Doc<"edits"> },
	status: EditWorkStatus
) {
	return safeTry(async function* () {
		yield* requireEditorIdentity(access.identity);
		yield* requireEditStatus(access.edit, EDIT_WORK_STATUSES);

		return ok(yield* patchEditStatus(ctx, access.edit, { status }));
	});
}

export function saveEditDeliverablesEmailResult(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	args: {
		editId: Id<"edits">;
		lockId: string;
		recipient: DeliverablesEmailRecipient;
		outcome: DeliverablesEmailOutcome;
	}
) {
	return safeTry(async function* () {
		const edit = yield* loadSessionEdit(ctx, session, args.editId);

		return ok(yield* saveDeliverablesEmailResult(ctx, edit, args));
	});
}
