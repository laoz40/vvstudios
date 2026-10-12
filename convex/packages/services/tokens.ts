import { type ResultAsync, ok, safeTry } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { refreshedScheduleTokenResultForPackage } from "#convex/packages/lib/paidLifecycle";
import {
	createPackageScheduleToken,
	validatePackageScheduleTokenRefresh
} from "#convex/packages/lib/scheduling";
import { patchPackageScheduleTokenRefresh } from "#convex/packages/lib/updates";
import { getPackageFromDb } from "#convex/packages/services/lookup";
import type { PaidPackageResult } from "#convex/packages/lib/payment";
import type { PackageLookupError } from "#convex/packages/lib/lookup";

export function refreshPaidPackageScheduleToken(
	ctx: MutationCtx,
	packageId: Id<"packages">
): ResultAsync<
	PaidPackageResult,
	| PackageLookupError
	| { reason: "PACKAGE_SCHEDULE_EMAIL_NOT_RETRYABLE" }
	| { reason: "PACKAGE_SCHEDULE_LINK_NOT_READY" }
> {
	return safeTry(async function* () {
		const packageRecord = yield* getPackageFromDb(ctx, packageId);
		const validatedPackage = yield* validatePackageScheduleTokenRefresh(packageRecord);
		const { scheduleTokenHash, token } = yield* createPackageScheduleToken();
		yield* patchPackageScheduleTokenRefresh(ctx, packageId, scheduleTokenHash);

		return ok(refreshedScheduleTokenResultForPackage(validatedPackage, scheduleTokenHash, token));
	});
}
