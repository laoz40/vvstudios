import {
	loadSignedInEditor,
	saveSignedInEditorDetails,
	assignedEditorNameForIdentity,
	listBookingsForChangedEditorName
} from "#convex/shared/lib/authProfile";
import { updateBookingsAssignedEditorDisplayName } from "#convex/editor/services/editorAssignments";
import type { UserIdentity } from "convex/server";

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
	return saveEditorDetails(ctx, identity, editor).andThen(() =>
		updateAssignedEditorName(ctx, identity, editor)
	);
}

export function requirePermission(ctx: QueryCtx | MutationCtx, permission: Permission) {
	return requireUserPermission(ctx.auth, (token) => getEditorByTokenLib(ctx, token), permission);
}

export function saveSignedInEditorProfile(ctx: MutationCtx, identity: UserIdentity) {
	return loadSignedInEditor(ctx, identity).andThen((editor) =>
		persistSignedInEditor(ctx, identity, editor)
	);
}

export function saveAdminEditorEnrollment(ctx: MutationCtx, identity: UserIdentity) {
	return getEditorByTokenLib(ctx, identity.tokenIdentifier)
		.andThen(requireEnrollableEditorProfile)
		.andThen((editor: Doc<"editorProfiles"> | null) =>
			persistEditorForIdentity(ctx, identity, editor)
		);
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
	return listBookingsForChangedEditorName(ctx, identity, editor).andThen((bookings) =>
		updateBookingsAssignedEditorDisplayName(ctx, bookings, assignedEditorNameForIdentity(identity))
	);
}

function persistSignedInEditor(
	ctx: MutationCtx,
	identity: UserIdentity,
	editor: Doc<"editorProfiles"> | null
) {
	return saveSignedInEditorDetails(ctx, identity, editor).andThen(() =>
		updateAssignedEditorName(ctx, identity, editor)
	);
}
