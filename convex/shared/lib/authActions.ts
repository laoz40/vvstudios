import { ok } from "neverthrow";
import type { Result as ConvexResult } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import type { Doc } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/shared/lib/result";

export function loadActionEditor(ctx: ActionCtx, token: string) {
	return fromConvexTuple<Promise<ConvexResult<Doc<"editorProfiles"> | null, { reason: string }>>>(
		ctx.runQuery(internal.shared.auth.getEditorByToken, { token })
	).orElse(() => ok(null));
}
