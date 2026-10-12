import { ok, safeTry } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getCapacityConsumingPackageSessions } from "#convex/packages/lib/scheduling";
import { lookupPackageByScheduleTokenHash, validPackageByToken } from "#convex/packages/lib/lookup";
import { hashRescheduleTokenAsync } from "#convex/sessions/lib/rescheduleLinks";
import { patchPackageDefaultRecordingSpace } from "#convex/packages/lib/updates";
import { buildPackageTokenCustomerView } from "#convex/packages/lib/tokenView";

function buildPackageSchedulingPageView(ctx: QueryCtx, packageRecord: Doc<"packages">) {
	return safeTry(async function* () {
		const sessions = yield* getCapacityConsumingPackageSessions(
			ctx,
			packageRecord._id,
			packageRecord.packageSize
		);

		const customerView = buildPackageTokenCustomerView(packageRecord, sessions);

		return ok(customerView);
	});
}

export function getValidPackageByToken(ctx: QueryCtx | MutationCtx, token: string, now: number) {
	return safeTry(async function* () {
		const tokenHash = yield* hashRescheduleTokenAsync(token);
		const packageLookup = yield* lookupPackageByScheduleTokenHash(ctx, tokenHash);
		const packageRecord = yield* validPackageByToken(packageLookup, now);

		return ok(packageRecord);
	});
}

export function loadPackageSchedulingPageByToken(
	ctx: QueryCtx,
	args: { token: string; now: number }
) {
	return safeTry(async function* () {
		const packageRecord = yield* getValidPackageByToken(ctx, args.token, args.now);
		const pageView = yield* buildPackageSchedulingPageView(ctx, packageRecord);

		return ok(pageView);
	});
}

export function writePackageDefaultRecordingSpace(
	ctx: MutationCtx,
	args: { token: string; service: NonNullable<Doc<"packages">["defaultSpace"]>; now: number }
) {
	return safeTry(async function* () {
		const packageRecord = yield* getValidPackageByToken(ctx, args.token, args.now);
		const updated = yield* patchPackageDefaultRecordingSpace(ctx, packageRecord._id, args.service);

		return ok(updated);
	});
}

export function loadPaidPackageByScheduleToken(
	ctx: QueryCtx | MutationCtx,
	args: { token: string; now: number }
) {
	return getValidPackageByToken(ctx, args.token, args.now);
}
