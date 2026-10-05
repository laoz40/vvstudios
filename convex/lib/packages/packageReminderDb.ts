import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import type { PackageReminderType } from "#convex/lib/packages/packageReminders";
import { okOrThrow } from "#convex/lib/result";

type PackageReminderArgs = { packageId: Doc<"packages">["_id"]; reminderType: PackageReminderType };

export function patchPackageReminderEmailClaimed(
	ctx: MutationCtx,
	args: PackageReminderArgs & { now: number }
) {
	return okOrThrow(
		ctx.db
			.patch("packages", args.packageId, {
				packageReminderState: { type: args.reminderType, status: "claimed", claimedAt: args.now }
			})
			.then(() => null)
	);
}

export function patchPackageReminderEmailSent(
	ctx: MutationCtx,
	args: PackageReminderArgs & { now: number }
) {
	return okOrThrow(
		ctx.db
			.patch("packages", args.packageId, {
				packageReminderState: { type: args.reminderType, status: "sent", sentAt: args.now }
			})
			.then(() => null)
	);
}

export function patchPackageReminderEmailFailed(
	ctx: MutationCtx,
	args: PackageReminderArgs & { failureCode: string }
) {
	return okOrThrow(
		ctx.db
			.patch("packages", args.packageId, {
				packageReminderState: {
					type: args.reminderType,
					status: "failed",
					failureCode: args.failureCode
				}
			})
			.then(() => null)
	);
}
