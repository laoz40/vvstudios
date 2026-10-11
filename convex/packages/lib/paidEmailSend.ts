import type { Id } from "#convex/_generated/dataModel";
import { internal } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import { fromConvexTuple } from "#convex/shared/lib/result";

export function packageReceiptEmailAttemptArgs(
	packageId: Id<"packages">,
	status: "sent" | "failed",
	receiptNumberOrFailureCode?: string
) {
	return {
		packageId,
		status,
		receiptNumber: status === "sent" ? receiptNumberOrFailureCode : undefined,
		failureCode: status === "failed" ? receiptNumberOrFailureCode : undefined
	};
}

export function recordPackageScheduleEmailAttempt(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	status: "sent" | "failed"
) {
	return fromConvexTuple(
		ctx.runMutation(internal.packages.admin.markPackageScheduleEmailAttempt, { packageId, status })
	);
}

export function recordPackageReceiptEmailAttempt(
	ctx: ActionCtx,
	packageId: Id<"packages">,
	status: "sent" | "failed",
	receiptNumberOrFailureCode?: string
) {
	return fromConvexTuple(
		ctx.runMutation(
			internal.packages.admin.markPackageReceiptEmailAttempt,
			packageReceiptEmailAttemptArgs(packageId, status, receiptNumberOrFailureCode)
		)
	);
}
