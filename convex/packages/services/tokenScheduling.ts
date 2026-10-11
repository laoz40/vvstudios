import type { ResultAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { getCapacityConsumingPackageSessions } from "#convex/packages/lib/scheduling";
import {
	lookupPackageByScheduleTokenHash,
	validPackageByToken,
	type ValidPackage,
	type ValidPackageByTokenError
} from "#convex/packages/lib/lookup";
import { hashRescheduleTokenAsync } from "#convex/sessions/lib/rescheduleLinks";
import { patchPackageDefaultRecordingSpace } from "#convex/packages/lib/updates";
import { buildPackageTokenCustomerView } from "#convex/packages/lib/tokenView";

function buildPackageSchedulingPageView(ctx: QueryCtx, packageRecord: Doc<"packages">) {
	return getCapacityConsumingPackageSessions(ctx, packageRecord._id, packageRecord.packageSize).map(
		(sessions) => buildPackageTokenCustomerView(packageRecord, sessions)
	);
}

export function getValidPackageByToken(
	ctx: QueryCtx | MutationCtx,
	token: string,
	now: number
): ResultAsync<ValidPackage, ValidPackageByTokenError> {
	return hashRescheduleTokenAsync(token)
		.andThen((scheduleTokenHash) => lookupPackageByScheduleTokenHash(ctx, scheduleTokenHash))
		.andThen((packageFromDb) => validPackageByToken(packageFromDb, now));
}

export function loadPackageSchedulingPageByToken(
	ctx: QueryCtx,
	args: { token: string; now: number }
) {
	return getValidPackageByToken(ctx, args.token, args.now).andThen(
		(packageRecord: Doc<"packages">) => buildPackageSchedulingPageView(ctx, packageRecord)
	);
}

export function writePackageDefaultRecordingSpace(
	ctx: MutationCtx,
	args: { token: string; service: NonNullable<Doc<"packages">["defaultSpace"]>; now: number }
) {
	return getValidPackageByToken(ctx, args.token, args.now).andThen(
		(packageRecord: Doc<"packages">) =>
			patchPackageDefaultRecordingSpace(ctx, packageRecord._id, args.service)
	);
}

export function loadPaidPackageByScheduleToken(
	ctx: QueryCtx | MutationCtx,
	args: { token: string; now: number }
) {
	return getValidPackageByToken(ctx, args.token, args.now);
}
