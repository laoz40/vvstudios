import type { UserIdentity } from "convex/server";
import type { ResultAsync } from "neverthrow";
import { internal } from "#convex/_generated/api";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { isAdminIdentity } from "#convex/lib/auth";
import { okOrThrow } from "#convex/lib/result";

type EditStatus = NonNullable<Doc<"bookings">["editStatus"]>;

export function shouldNotifyHostOfDeliverablesReview(args: {
	identity: UserIdentity;
	previousEditStatus: EditStatus | undefined;
	nextEditStatus: EditStatus;
}) {
	return (
		args.nextEditStatus === "review" &&
		args.previousEditStatus !== "review" &&
		!isAdminIdentity(args.identity)
	);
}

export function scheduleDeliverablesReviewHostEmail(
	ctx: MutationCtx,
	args: {
		bookingId: Id<"bookings">;
		clientName: string;
		editorName: string;
		idempotencyKey: string;
		sessionDate: string;
	}
): ResultAsync<null, never> {
	return okOrThrow(
		ctx.scheduler
			.runAfter(0, internal.deliverablesReviewEmail.sendDeliverablesReviewReadyEmail, args)
			.then(() => null)
	);
}
