import { err } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";

import { patchRescheduleLinkRow } from "#convex/sessions/lib/rescheduleLinks";

type UnlockRescheduleLinkError =
	| { reason: "RESCHEDULE_LINK_NOT_FOUND" }
	| { reason: "RESCHEDULE_LINK_USED" };

type UnlockRescheduleLinkPatch = { status: "active"; usedAt: undefined; expiresAt?: number };

export function unlockRescheduleLinkIfLocked(
	ctx: MutationCtx,
	args: { linkId: Doc<"bookingRescheduleLinks">["_id"]; lockedAt: number; expiresAt?: number },
	link: Doc<"bookingRescheduleLinks"> | null
) {
	if (link === null) {
		return err<never, UnlockRescheduleLinkError>({ reason: "RESCHEDULE_LINK_NOT_FOUND" });
	}

	if (link.status !== "used" || link.usedAt !== args.lockedAt) {
		return err<never, UnlockRescheduleLinkError>({ reason: "RESCHEDULE_LINK_USED" });
	}

	const patch: UnlockRescheduleLinkPatch = { status: "active", usedAt: undefined };

	if (args.expiresAt !== undefined) {
		patch.expiresAt = args.expiresAt;
	}

	return patchRescheduleLinkRow(ctx, args.linkId, patch);
}
