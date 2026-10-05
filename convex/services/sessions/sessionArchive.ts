import type { MutationCtx } from "#convex/_generated/server";
import { tryPromise } from "#convex/lib/result";
import { archivePastDeadCheckoutSessionsBatch } from "#convex/lib/sessions/sessionArchive";

export function runArchivePastDeadCheckoutBatch(
	ctx: MutationCtx,
	cursor: string | null,
	numItems?: number
) {
	return tryPromise({
		try: () => archivePastDeadCheckoutSessionsBatch(ctx, cursor, numItems),
		catch: () => ({ reason: "SESSION_ARCHIVE_FAILED" as const })
	});
}
