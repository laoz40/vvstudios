import type { UserIdentity } from "convex/server";
import { ok, type ResultAsync } from "neverthrow";
import type { Result as ConvexResult } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/shared/lib/result";
import type { Permission } from "#/lib/permissions";
import { requireUserPermission } from "#convex/shared/services/authPermissions";

export type PermissionActionError = { reason: "NOT_AUTHENTICATED" | "NOT_AUTHORIZED" };

export function requirePermissionActions(
	ctx: ActionCtx,
	permission: Permission
): ResultAsync<UserIdentity, PermissionActionError> {
	return requireUserPermission(
		ctx.auth,
		(token) =>
			fromConvexTuple<Promise<ConvexResult<Doc<"editorProfiles"> | null, { reason: string }>>>(
				ctx.runQuery(internal.shared.auth.getEditorByToken, { token })
			).orElse(() => ok(null)),
		permission
	);
}
