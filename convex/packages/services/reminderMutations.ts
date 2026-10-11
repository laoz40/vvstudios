import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getPackageFromDb } from "#convex/packages/services/lookup";
import {
	patchPackageReminderEmailClaimed,
	patchPackageReminderEmailFailed,
	patchPackageReminderEmailSent
} from "#convex/packages/lib/reminderDb";
import {
	validatePackageReminderClaim,
	type PackageReminderType
} from "#convex/packages/lib/reminders";

type PackageReminderArgs = { packageId: Doc<"packages">["_id"]; reminderType: PackageReminderType };

export function claimPackageReminderEmail(
	ctx: MutationCtx,
	args: PackageReminderArgs & { now: number }
) {
	return getPackageFromDb(ctx, args.packageId)
		.andThen((packageFromDb: Doc<"packages">) =>
			validatePackageReminderClaim(packageFromDb, args.reminderType)
		)
		.andThen(() => patchPackageReminderEmailClaimed(ctx, args));
}

export function writePackageReminderEmailSent(
	ctx: MutationCtx,
	args: PackageReminderArgs & { now: number }
) {
	return getPackageFromDb(ctx, args.packageId).andThen(() =>
		patchPackageReminderEmailSent(ctx, args)
	);
}

export function writePackageReminderEmailFailed(
	ctx: MutationCtx,
	args: PackageReminderArgs & { failureCode: string }
) {
	return getPackageFromDb(ctx, args.packageId).andThen(() =>
		patchPackageReminderEmailFailed(ctx, args)
	);
}
