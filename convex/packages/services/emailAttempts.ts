import { ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { searchBlobPatchForPackage } from "#convex/shared/lib/adminSearch/adminSearchBlob";
import { syncPackageBookingsReceiptNumber } from "#convex/packages/services/bookingsReceiptSync";
import {
	patchPackageReceiptEmailAttempt,
	patchPackageScheduleEmailStatus
} from "#convex/packages/lib/updates";
import { getPackageFromDb } from "#convex/packages/services/lookup";

function patchPackageScheduleEmailForArgs(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; status: "sent" | "failed" }
) {
	return patchPackageScheduleEmailStatus(ctx, args.packageId, args.status);
}

export function writePackageScheduleEmailAttempt(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; status: "sent" | "failed" }
) {
	return getPackageFromDb(ctx, args.packageId).andThen(() =>
		patchPackageScheduleEmailForArgs(ctx, args)
	);
}

function afterReceiptEmailPatch(
	ctx: MutationCtx,
	args: { packageId: Id<"packages">; status: "sent" | "failed"; receiptNumber?: string }
) {
	if (args.status !== "sent" || !args.receiptNumber) {
		return ok(null);
	}

	return syncPackageBookingsReceiptNumber(ctx, args.packageId, args.receiptNumber);
}

function patchReceiptEmailForPackage(
	ctx: MutationCtx,
	args: {
		packageId: Id<"packages">;
		status: "sent" | "failed";
		receiptNumber?: string;
		failureCode?: string;
	},

	packageFromDb: Doc<"packages">
) {
	const now = Date.now();

	const sentPatch =
		args.status === "sent"
			? {
					receiptEmailFailureCode: undefined,
					receiptEmailSentAt: now,
					receiptEmailStatus: "sent" as const,
					receiptNumber: args.receiptNumber,
					lastReceiptEmailAttemptAt: now,
					...searchBlobPatchForPackage(packageFromDb, { receiptNumber: args.receiptNumber })
				}
			: {
					receiptEmailFailureCode: args.failureCode,
					receiptEmailStatus: "failed" as const,
					lastReceiptEmailAttemptAt: now
				};

	return patchPackageReceiptEmailAttempt(ctx, args.packageId, sentPatch).andThen(() =>
		afterReceiptEmailPatch(ctx, args)
	);
}

export function writePackageReceiptEmailAttempt(
	ctx: MutationCtx,
	args: {
		packageId: Id<"packages">;
		status: "sent" | "failed";
		receiptNumber?: string;
		failureCode?: string;
	}
) {
	return getPackageFromDb(ctx, args.packageId).andThen((packageFromDb: Doc<"packages">) =>
		patchReceiptEmailForPackage(ctx, args, packageFromDb)
	);
}
