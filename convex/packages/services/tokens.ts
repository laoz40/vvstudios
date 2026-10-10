import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import type { PaidPackageResult } from "#convex/packages/lib/payment";
import {
	createPackageScheduleToken,
	validatePackageScheduleTokenRefresh
} from "#convex/packages/lib/scheduling";
import { patchPackageScheduleTokenRefresh } from "#convex/packages/lib/updates";
import { getPackageFromDb } from "#convex/packages/services/lookup";

function attachScheduleTokenToPackage(
	packageFromDb: Doc<"packages">,
	scheduleToken: { scheduleTokenHash: string; token: string }
) {
	return { packageFromDb, ...scheduleToken };
}

function createScheduleTokenForPackage(packageFromDb: Doc<"packages">) {
	return createPackageScheduleToken().map(
		(scheduleToken: { scheduleTokenHash: string; token: string }) =>
			attachScheduleTokenToPackage(packageFromDb, scheduleToken)
	);
}

function refreshScheduleTokenForPackage(
	ctx: MutationCtx,
	packageId: Id<"packages">,
	{
		packageFromDb,
		scheduleTokenHash,
		token
	}: { packageFromDb: Doc<"packages">; scheduleTokenHash: string; token: string }
) {
	return patchPackageScheduleTokenRefresh(ctx, packageId, scheduleTokenHash).map(() =>
		refreshedScheduleTokenResultForPackage(packageFromDb, scheduleTokenHash, token)
	);
}

function refreshedScheduleTokenResultForPackage(
	packageFromDb: Doc<"packages">,
	scheduleTokenHash: string,
	token: string
) {
	return {
		expiresAt: packageFromDb.expiresAt!,
		paidAt: packageFromDb.paidAt!,
		packageRecord: { ...packageFromDb, scheduleLinkStatus: "active" as const, scheduleTokenHash },
		token
	} satisfies PaidPackageResult;
}

export function refreshPaidPackageScheduleToken(ctx: MutationCtx, packageId: Id<"packages">) {
	return getPackageFromDb(ctx, packageId)
		.andThen(validatePackageScheduleTokenRefresh)
		.andThen(createScheduleTokenForPackage)
		.andThen((value) => refreshScheduleTokenForPackage(ctx, packageId, value));
}
