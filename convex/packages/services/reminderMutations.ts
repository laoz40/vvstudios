import { ok, safeTry } from "neverthrow";
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
	return safeTry(async function* () {
		const packageRecord = yield* getPackageFromDb(ctx, args.packageId);
		yield* validatePackageReminderClaim(packageRecord, args.reminderType);
		const claimed = yield* patchPackageReminderEmailClaimed(ctx, args);

		return ok(claimed);
	});
}

export function writePackageReminderEmailSent(
	ctx: MutationCtx,
	args: PackageReminderArgs & { now: number }
) {
	return safeTry(async function* () {
		yield* getPackageFromDb(ctx, args.packageId);
		const updated = yield* patchPackageReminderEmailSent(ctx, args);

		return ok(updated);
	});
}

export function writePackageReminderEmailFailed(
	ctx: MutationCtx,
	args: PackageReminderArgs & { failureCode: string }
) {
	return safeTry(async function* () {
		yield* getPackageFromDb(ctx, args.packageId);
		const updated = yield* patchPackageReminderEmailFailed(ctx, args);

		return ok(updated);
	});
}
