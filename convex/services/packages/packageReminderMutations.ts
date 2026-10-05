import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getPackageFromDb } from "#convex/services/packages/packageLookup";
import {
	patchPackageReminderEmailClaimed,
	patchPackageReminderEmailFailed,
	patchPackageReminderEmailSent
} from "#convex/lib/packages/packageReminderDb";
import {
	validatePackageReminderClaim,
	type PackageReminderType
} from "#convex/lib/packages/packageReminders";

type PackageReminderArgs = { packageId: Doc<"packages">["_id"]; reminderType: PackageReminderType };

function validatePackageReminderClaimForArgs(args: PackageReminderArgs) {
	return (packageFromDb: Doc<"packages">) =>
		validatePackageReminderClaim(packageFromDb, args.reminderType);
}

function patchPackageReminderClaimedForArgs(
	ctx: MutationCtx,
	args: PackageReminderArgs & { now: number }
) {
	return () => patchPackageReminderEmailClaimed(ctx, args);
}

function patchPackageReminderSentForArgs(
	ctx: MutationCtx,
	args: PackageReminderArgs & { now: number }
) {
	return () => patchPackageReminderEmailSent(ctx, args);
}

function patchPackageReminderFailedForArgs(
	ctx: MutationCtx,
	args: PackageReminderArgs & { failureCode: string }
) {
	return () => patchPackageReminderEmailFailed(ctx, args);
}

export function claimPackageReminderEmail(
	ctx: MutationCtx,
	args: PackageReminderArgs & { now: number }
) {
	return getPackageFromDb(ctx, args.packageId)
		.andThen(validatePackageReminderClaimForArgs(args))
		.andThen(patchPackageReminderClaimedForArgs(ctx, args));
}

export function writePackageReminderEmailSent(
	ctx: MutationCtx,
	args: PackageReminderArgs & { now: number }
) {
	return getPackageFromDb(ctx, args.packageId).andThen(patchPackageReminderSentForArgs(ctx, args));
}

export function writePackageReminderEmailFailed(
	ctx: MutationCtx,
	args: PackageReminderArgs & { failureCode: string }
) {
	return getPackageFromDb(ctx, args.packageId).andThen(
		patchPackageReminderFailedForArgs(ctx, args)
	);
}
