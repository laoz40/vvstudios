import type { UserIdentity } from "convex/server";
import { err, errAsync, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { isAdminIdentity } from "#convex/shared/lib/auth";
import { okOrThrow } from "#convex/shared/lib/result";

export type DeliverablesEmailRecipient = "client" | "admin_review";

export type DeliverablesEmailOutcome = { kind: "sent"; sentAt: number } | { kind: "failed" };

export type EditActionError =
	| { reason: "EDIT_NOT_FOUND" }
	| { reason: "INVALID_EDIT_STATUS" }
	| { reason: "EDIT_EMAIL_IN_PROGRESS" }
	| { reason: "EDIT_REQUIRED" };

const EMAIL_LOCK_DURATION_MS = 15 * 60 * 1000;

export function requireSessionLevelEditing(session: Doc<"bookings">) {
	return session.editStatusScope === "edit"
		? err({ reason: "EDIT_REQUIRED" as const })
		: ok(session);
}

export function loadEdit(ctx: MutationCtx, editId: Id<"edits">) {
	return okOrThrow(ctx.db.get("edits", editId));
}

export function requireSessionEdit(session: Doc<"bookings">, edit: Doc<"edits"> | null) {
	return edit !== null && edit.bookingId === session._id && session.editStatusScope === "edit"
		? ok(edit)
		: err({ reason: "EDIT_NOT_FOUND" as const });
}

export function requireEditorIdentity(identity: UserIdentity) {
	return isAdminIdentity(identity) ? err({ reason: "NOT_AUTHORIZED" as const }) : ok(identity);
}

export function requireDeliverablesEmailPermission(
	editor: Doc<"editorProfiles"> | null,
	session: Doc<"bookings">,
	recipient: DeliverablesEmailRecipient
) {
	const canSendToClient =
		editor?.canSendDeliverables === true && session.editDeliveryMode !== "studio_review_only";

	if (editor === null || canSendToClient !== (recipient === "client")) {
		return err({ reason: "NOT_AUTHORIZED" as const });
	}

	return ok(editor);
}

export function requireEditStatus(
	edit: Doc<"edits">,
	allowedStatuses: readonly Doc<"edits">["status"][]
) {
	if (edit.pendingEmail !== undefined && edit.pendingEmail.expiresAt > Date.now()) {
		return err({ reason: "EDIT_EMAIL_IN_PROGRESS" as const });
	}

	return allowedStatuses.includes(edit.status)
		? ok(edit)
		: err({ reason: "INVALID_EDIT_STATUS" as const });
}

export function saveDeliverablesEmailLock(ctx: MutationCtx, edit: Doc<"edits">, lockId: string) {
	return okOrThrow(
		ctx.db.patch("edits", edit._id, {
			pendingEmail: { id: lockId, expiresAt: Date.now() + EMAIL_LOCK_DURATION_MS }
		})
	);
}

export function patchEditStatus(
	ctx: MutationCtx,
	edit: Doc<"edits">,
	updates: Pick<Doc<"edits">, "status" | "deliveredAt">
) {
	return okOrThrow(ctx.db.patch("edits", edit._id, { ...updates, pendingEmail: undefined }));
}

export function saveDeliverablesEmailResult(
	ctx: MutationCtx,
	edit: Doc<"edits">,
	args: { lockId: string; recipient: DeliverablesEmailRecipient; outcome: DeliverablesEmailOutcome }
) {
	// A send that outlasts its lock cannot overwrite a newer attempt's result.
	if (edit.pendingEmail?.id !== args.lockId) {
		return errAsync({ reason: "INVALID_EDIT_STATUS" as const });
	}

	if (args.outcome.kind === "failed") {
		return okOrThrow(ctx.db.patch("edits", edit._id, { pendingEmail: undefined }));
	}

	return patchEditStatus(
		ctx,
		edit,
		args.recipient === "client"
			? { status: "sent", deliveredAt: args.outcome.sentAt }
			: { status: "review" }
	);
}
