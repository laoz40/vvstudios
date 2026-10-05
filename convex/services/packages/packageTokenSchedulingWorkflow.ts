import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getCapacityConsumingPackageSessions } from "#convex/lib/packages/packageScheduling";
import { getValidPackageByToken as findValidPackageByToken } from "#convex/lib/packages/packageLookup";
import { okOrThrow } from "#convex/lib/result";
import { buildPackageTokenCustomerView } from "#convex/lib/packages/packageTokenView";

export function loadPackageSchedulingPageByToken(
	ctx: QueryCtx,
	args: { token: string; now: number }
) {
	return findValidPackageByToken(ctx, args.token, args.now).andThen((packageRecord) =>
		getCapacityConsumingPackageSessions(ctx, packageRecord._id, packageRecord.packageSize).map(
			(sessions) => buildPackageTokenCustomerView(packageRecord, sessions)
		)
	);
}

export function writePackageDefaultRecordingSpace(
	ctx: MutationCtx,
	args: { token: string; service: NonNullable<Doc<"packages">["defaultSpace"]>; now: number }
) {
	return findValidPackageByToken(ctx, args.token, args.now).andThen((packageRecord) =>
		okOrThrow(
			ctx.db
				.patch("packages", packageRecord._id, { defaultSpace: args.service })
				.then(() => ({ defaultSpace: args.service }))
		)
	);
}

export function loadPaidPackageByScheduleToken(
	ctx: QueryCtx | MutationCtx,
	args: { token: string; now: number }
) {
	return findValidPackageByToken(ctx, args.token, args.now);
}
