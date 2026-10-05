import { okOrThrow } from "#convex/lib/result";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getPackageFromDb } from "#convex/lib/packages/packageLookup";
import {
	validatePackageReminderClaim,
	type PackageReminderType
} from "#convex/lib/packages/packageReminders";

type PackageReminderArgs = { packageId: Doc<"packages">["_id"]; reminderType: PackageReminderType };

export function claimPackageReminderEmail(
	ctx: MutationCtx,
	args: PackageReminderArgs & { now: number }
) {
	return getPackageFromDb(ctx, args.packageId)
		.andThen((packageFromDb) => validatePackageReminderClaim(packageFromDb, args.reminderType))
		.andThen(() =>
			okOrThrow(
				ctx.db
					.patch("packages", args.packageId, {
						packageReminderState: {
							type: args.reminderType,
							status: "claimed",
							claimedAt: args.now
						}
					})
					.then(() => null)
			)
		);
}

export function writePackageReminderEmailSent(
	ctx: MutationCtx,
	args: PackageReminderArgs & { now: number }
) {
	return getPackageFromDb(ctx, args.packageId).andThen(() =>
		okOrThrow(
			ctx.db
				.patch("packages", args.packageId, {
					packageReminderState: { type: args.reminderType, status: "sent", sentAt: args.now }
				})
				.then(() => null)
		)
	);
}

export function writePackageReminderEmailFailed(
	ctx: MutationCtx,
	args: PackageReminderArgs & { failureCode: string }
) {
	return getPackageFromDb(ctx, args.packageId).andThen(() =>
		okOrThrow(
			ctx.db
				.patch("packages", args.packageId, {
					packageReminderState: {
						type: args.reminderType,
						status: "failed",
						failureCode: args.failureCode
					}
				})
				.then(() => null)
		)
	);
}
