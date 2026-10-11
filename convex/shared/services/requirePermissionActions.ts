import { loadActionEditor } from "#convex/shared/lib/authActions";
import type { UserIdentity } from "convex/server";
import { type ResultAsync } from "neverthrow";

import type { ActionCtx } from "#convex/_generated/server";

import type { Permission } from "#/lib/permissions";
import { requireUserPermission } from "#convex/shared/services/authPermissions";

export type PermissionActionError = { reason: "NOT_AUTHENTICATED" | "NOT_AUTHORIZED" };

export function requirePermissionActions(
	ctx: ActionCtx,
	permission: Permission
): ResultAsync<UserIdentity, PermissionActionError> {
	return requireUserPermission(ctx.auth, (token) => loadActionEditor(ctx, token), permission);
}
