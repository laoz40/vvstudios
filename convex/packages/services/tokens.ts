import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { refreshedScheduleTokenResultForPackage } from "#convex/packages/lib/paidLifecycle";
import {
	createPackageScheduleToken,
	validatePackageScheduleTokenRefresh
} from "#convex/packages/lib/scheduling";
import { patchPackageScheduleTokenRefresh } from "#convex/packages/lib/updates";
import { getPackageFromDb } from "#convex/packages/services/lookup";

export function refreshPaidPackageScheduleToken(ctx: MutationCtx, packageId: Id<"packages">) {
	return getPackageFromDb(ctx, packageId)
		.andThen(validatePackageScheduleTokenRefresh)
		.andThen((packageFromDb: Doc<"packages">) =>
			createPackageScheduleToken().map((token) => ({ packageFromDb, ...token }))
		)
		.andThen(({ packageFromDb, scheduleTokenHash, token }) =>
			patchPackageScheduleTokenRefresh(ctx, packageId, scheduleTokenHash).map(() =>
				refreshedScheduleTokenResultForPackage(packageFromDb, scheduleTokenHash, token)
			)
		);
}
