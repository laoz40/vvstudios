import type { MutationCtx } from "#convex/_generated/server";
import { checkBookingSubmitRateLimit } from "#convex/shared/services/rateLimits";
import {
	createPendingPackageRecord,
	type CreatePendingPackageArgs
} from "#convex/packages/lib/updates";

export function enforcePackageSubmitRateLimit(ctx: MutationCtx, submitRateLimitKey: string) {
	return checkBookingSubmitRateLimit(ctx, submitRateLimitKey);
}

export function insertPendingPackageRecord(ctx: MutationCtx, args: CreatePendingPackageArgs) {
	return createPendingPackageRecord(ctx, args);
}
