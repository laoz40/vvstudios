import {
	loadSignedInEditor,
	saveSignedInEditorDetails,
	assignedEditorNameForIdentity,
	listBookingsForChangedEditorName
} from "#convex/shared/lib/authProfile";
import { updateBookingsAssignedEditorDisplayName } from "#convex/editor/services/editorAssignments";
import type { UserIdentity } from "convex/server";
import { ok, safeTry } from "neverthrow";

import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	getEditorByToken as getEditorByTokenLib,
	requireAdminIdentity as requireAdminIdentityLib,
	requireEnrollableEditorProfile,
	saveEditorDetails
} from "#convex/shared/lib/auth";
import { requireUser as requireUserLib } from "#convex/shared/services/authIdentity";

import type { Permission } from "#/lib/permissions";
import {
	loadUserAccessForIdentity as loadUserAccessForIdentityLib,
	requireUserPermission
} from "#convex/shared/services/authPermissions";

function persistEditorForIdentity(
	ctx: MutationCtx,
	identity: UserIdentity,
	editor: Doc<"editorProfiles"> | null
) {
	return safeTry(async function* () {
		yield* saveEditorDetails(ctx, identity, editor);
		const updated = yield* updateAssignedEditorName(ctx, identity, editor);

		return ok(updated);
	});
}

export function requirePermission(ctx: QueryCtx | MutationCtx, permission: Permission) {
	return requireUserPermission(ctx.auth, (token) => getEditorByTokenLib(ctx, token), permission);
}

export function saveSignedInEditorProfile(ctx: MutationCtx, identity: UserIdentity) {
	return safeTry(async function* () {
		const editor = yield* loadSignedInEditor(ctx, identity);
		const saved = yield* persistSignedInEditor(ctx, identity, editor);

		return ok(saved);
	});
}

export function saveAdminEditorEnrollment(ctx: MutationCtx, identity: UserIdentity) {
	return safeTry(async function* () {
		const editor = yield* getEditorByTokenLib(ctx, identity.tokenIdentifier);
		const enrollableEditor = yield* requireEnrollableEditorProfile(editor);
		const saved = yield* persistEditorForIdentity(ctx, identity, enrollableEditor);

		return ok(saved);
	});
}

export function getEditorByToken(ctx: QueryCtx | MutationCtx, token: string) {
	return getEditorByTokenLib(ctx, token);
}

export function requireAdminIdentity(identity: UserIdentity) {
	return requireAdminIdentityLib(identity);
}

export function requireUser(ctx: QueryCtx | MutationCtx) {
	return requireUserLib(ctx);
}

export function loadUserAccessForIdentity(ctx: QueryCtx | MutationCtx, identity: UserIdentity) {
	return loadUserAccessForIdentityLib(ctx, identity);
}

function updateAssignedEditorName(
	ctx: MutationCtx,
	identity: UserIdentity,
	editor: Doc<"editorProfiles"> | null
) {
	return safeTry(async function* () {
		const bookings = yield* listBookingsForChangedEditorName(ctx, identity, editor);

		const updated = yield* updateBookingsAssignedEditorDisplayName(
			ctx,
			bookings,
			assignedEditorNameForIdentity(identity)
		);

		return ok(updated);
	});
}

function persistSignedInEditor(
	ctx: MutationCtx,
	identity: UserIdentity,
	editor: Doc<"editorProfiles"> | null
) {
	return safeTry(async function* () {
		yield* saveSignedInEditorDetails(ctx, identity, editor);
		const updated = yield* updateAssignedEditorName(ctx, identity, editor);

		return ok(updated);
	});
}
