import type { MutationCtx } from "#convex/_generated/server";
import { checkBookingSubmitRateLimit } from "#convex/shared/lib/rateLimits";
import {
	buildPendingPackageRecord,
	type CreatePendingPackageArgs,
	insertPendingPackageRow
} from "#convex/packages/lib/updates";

export function enforcePackageSubmitRateLimit(ctx: MutationCtx, submitRateLimitKey: string) {
	return checkBookingSubmitRateLimit(ctx, submitRateLimitKey);
}

export function insertPendingPackageRecord(ctx: MutationCtx, args: CreatePendingPackageArgs) {
	const createdAt = Date.now();

	const packageRecord = buildPendingPackageRecord(
		{ ...args, email: args.email.trim().toLowerCase() },
		createdAt
	);

	return insertPendingPackageRow(ctx, packageRecord);
}
