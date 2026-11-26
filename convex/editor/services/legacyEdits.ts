import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { insertEdits, planLegacyEdits } from "#convex/editor/lib/edits";

export function createLegacyEditsForSession(ctx: MutationCtx, session: Doc<"bookings">) {
	const { edits, patch } = planLegacyEdits(session);

	return insertEdits(ctx, edits)
		.map(() => patch)
		.unwrapOr(undefined);
}
