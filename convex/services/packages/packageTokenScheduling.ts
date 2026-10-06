import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getCapacityConsumingPackageSessions } from "#convex/lib/packages/packageScheduling";
import { getValidPackageByToken as findValidPackageByToken } from "#convex/lib/packages/packageLookup";
import { patchPackageDefaultRecordingSpace } from "#convex/lib/packages/packageUpdates";
import { buildPackageTokenCustomerView } from "#convex/lib/packages/packageTokenView";

function buildPackageSchedulingPageView(ctx: QueryCtx, packageRecord: Doc<"packages">) {
	return getCapacityConsumingPackageSessions(ctx, packageRecord._id, packageRecord.packageSize).map(
		buildPackageTokenCustomerView.bind(null, packageRecord)
	);
}

function patchDefaultRecordingSpaceForPackage(
	ctx: MutationCtx,
	service: NonNullable<Doc<"packages">["defaultSpace"]>,

	packageRecord: Doc<"packages">
) {
	return patchPackageDefaultRecordingSpace(ctx, packageRecord._id, service);
}

export function loadPackageSchedulingPageByToken(
	ctx: QueryCtx,
	args: { token: string; now: number }
) {
	return findValidPackageByToken(ctx, args.token, args.now).andThen(
		(packageRecord: Doc<"packages">) => buildPackageSchedulingPageView(ctx, packageRecord)
	);
}

export function writePackageDefaultRecordingSpace(
	ctx: MutationCtx,
	args: { token: string; service: NonNullable<Doc<"packages">["defaultSpace"]>; now: number }
) {
	return findValidPackageByToken(ctx, args.token, args.now).andThen(
		(packageRecord: Doc<"packages">) =>
			patchDefaultRecordingSpaceForPackage(ctx, args.service, packageRecord)
	);
}

export function loadPaidPackageByScheduleToken(
	ctx: QueryCtx | MutationCtx,
	args: { token: string; now: number }
) {
	return findValidPackageByToken(ctx, args.token, args.now);
}
