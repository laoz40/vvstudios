import type { PaginationOptions } from "convex/server";
import { err, ok } from "neverthrow";
import type { Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { setPackageArchived } from "#convex/lib/archiveState";
import { requirePermission } from "#convex/lib/auth";
import { getPackageFromDb } from "#convex/lib/packages/packageLookup";
import {
	createPackageScheduleToken,
	getCapacityConsumingPackageSessions,
	validatePackageScheduleTokenRefresh
} from "#convex/lib/packages/packageScheduling";
import {
	buildPendingPackageRecord,
	buildPackageUpdatePatch,
	parsePackageUpdate,
	type CreatePendingPackageArgs,
	type UpdatePackageArgs,
	validatePackageUpdate
} from "#convex/lib/packages/packageUpdates";
import { listAdminPackages, type AdminPackagesView } from "#convex/lib/listAdminPackages";
import {
	searchBlobPatchForBooking,
	searchBlobPatchForPackage,
	patchPackageSessionBookingsContactSearch,
	type PackageContactSearchFields
} from "#convex/lib/adminSearch/adminSearchBlob";
import { okOrThrow } from "#convex/lib/result";

type SavePackageInstagramHandleArgs = { packageId: Id<"packages">; instagramHandle: string };

type ArchivePackageArgs = { packageId: Id<"packages">; archived: boolean };

type PackageIdArgs = { packageId: Id<"packages"> };

type MarkPackageScheduleEmailAttemptArgs = PackageIdArgs & { status: "sent" | "failed" };

type MarkPackageReceiptEmailAttemptArgs = PackageIdArgs & {
	status: "sent" | "failed";
	receiptNumber?: string;
	failureCode?: string;
};

export type { PackageLookupError } from "#convex/lib/packages/packageLookup";

export type { PaidPackageResult } from "#convex/lib/packages/packagePayment";

export function createPendingPackageService(ctx: MutationCtx, args: CreatePendingPackageArgs) {
	const createdAt = Date.now();

	const packageRecord = buildPendingPackageRecord(
		{ ...args, email: args.email.trim().toLowerCase() },
		createdAt
	);

	return ctx.db
		.insert("packages", packageRecord)
		.then((packageId) => ({ packageRecord: { _id: packageId, ...packageRecord } }));
}

type PackageListSortDirection = "asc" | "desc";

type ListPackagesArgs = {
	paginationOpts: PaginationOptions;
	sortDirection?: PackageListSortDirection;
	view?: AdminPackagesView;
	includeStale?: boolean;
	searchQuery?: string;
};

export function listPackagesService(ctx: QueryCtx, args: ListPackagesArgs) {
	return requirePermission(ctx, "view:packages").andThen(() =>
		okOrThrow(listAdminPackages(ctx, args))
	);
}

export function updatePackageService(ctx: MutationCtx, args: UpdatePackageArgs) {
	return requirePermission(ctx, "edit:sessions")
		.andThen(() => getPackageFromDb(ctx, args.packageId))
		.andThen((existingPackage) =>
			parsePackageUpdate(args).map((updatedPackage) => ({ existingPackage, updatedPackage }))
		)
		.andThen(({ existingPackage, updatedPackage }) =>
			okOrThrow(
				getCapacityConsumingPackageSessions(ctx, existingPackage._id, existingPackage.packageSize)
			).map((activeBookedSessions) => ({ activeBookedSessions, existingPackage, updatedPackage }))
		)
		.andThen(({ activeBookedSessions, existingPackage, updatedPackage }) =>
			validatePackageUpdate(args, updatedPackage, activeBookedSessions.length).map(() => ({
				existingPackage,
				updatedPackage
			}))
		)
		.andThen(({ existingPackage, updatedPackage }) => {
			const contactFields: PackageContactSearchFields = {
				name: updatedPackage.name,
				phone: updatedPackage.phone,
				accountName: updatedPackage.accountName,
				abn: updatedPackage.abn,
				email: updatedPackage.email.trim().toLowerCase(),
				instagramHandle: existingPackage.instagramHandle
			};

			return okOrThrow(
				ctx.db
					.patch("packages", args.packageId, {
						...buildPackageUpdatePatch(args, updatedPackage),
						...searchBlobPatchForPackage(existingPackage, {
							...contactFields,
							notes: updatedPackage.notes,
							receiptNumber: existingPackage.receiptNumber
						})
					})
					.then(async () => {
						const contactChanged =
							existingPackage.name !== contactFields.name ||
							existingPackage.phone !== contactFields.phone ||
							existingPackage.accountName !== contactFields.accountName ||
							existingPackage.abn !== contactFields.abn ||
							existingPackage.email !== contactFields.email;

						if (contactChanged) {
							await patchPackageSessionBookingsContactSearch(ctx, args.packageId, contactFields);
						}

						return null;
					})
			);
		});
}

export function savePackageInstagramHandleService(
	ctx: MutationCtx,
	args: SavePackageInstagramHandleArgs
) {
	return getPackageFromDb(ctx, args.packageId)
		.andThen((packageFromDb) => {
			if (packageFromDb.status !== "pending_payment" && packageFromDb.status !== "paid") {
				return err({ reason: "PACKAGE_NOT_ACTIVE" as const });
			}

			return ok(packageFromDb);
		})
		.andThen((packageFromDb) =>
			okOrThrow(
				ctx.db
					.patch("packages", packageFromDb._id, {
						instagramHandle: args.instagramHandle,
						...searchBlobPatchForPackage(packageFromDb, { instagramHandle: args.instagramHandle })
					})
					.then(async () => {
						await patchPackageSessionBookingsContactSearch(ctx, packageFromDb._id, {
							name: packageFromDb.name,
							phone: packageFromDb.phone,
							accountName: packageFromDb.accountName,
							abn: packageFromDb.abn,
							email: packageFromDb.email,
							instagramHandle: args.instagramHandle
						});

						return null;
					})
			)
		);
}

export function archivePackageService(ctx: MutationCtx, args: ArchivePackageArgs) {
	return requirePermission(ctx, "archive:sessions")
		.andThen(() => getPackageFromDb(ctx, args.packageId))
		.andThen(() =>
			okOrThrow(setPackageArchived(ctx, args.packageId, args.archived).then(() => null))
		);
}

export function refreshPackageScheduleTokenService(ctx: MutationCtx, args: PackageIdArgs) {
	return getPackageFromDb(ctx, args.packageId)
		.andThen(validatePackageScheduleTokenRefresh)
		.andThen((packageFromDb) =>
			okOrThrow(createPackageScheduleToken()).map((scheduleToken) => ({
				packageFromDb,
				...scheduleToken
			}))
		)
		.andThen(({ packageFromDb, scheduleTokenHash, token }) =>
			okOrThrow(
				ctx.db
					.patch("packages", args.packageId, { scheduleLinkStatus: "active", scheduleTokenHash })
					.then(() => ({
						expiresAt: packageFromDb.expiresAt,
						paidAt: packageFromDb.paidAt,
						packageRecord: {
							...packageFromDb,
							scheduleLinkStatus: "active" as const,
							scheduleTokenHash
						},
						token
					}))
			)
		);
}

export function markPackageScheduleEmailAttemptService(
	ctx: MutationCtx,
	args: MarkPackageScheduleEmailAttemptArgs
) {
	return getPackageFromDb(ctx, args.packageId).andThen(() =>
		okOrThrow(
			ctx.db
				.patch("packages", args.packageId, {
					status: args.status === "sent" ? "paid" : "schedule_email_failed"
				})
				.then(() => null)
		)
	);
}

export function markPackageReceiptEmailAttemptService(
	ctx: MutationCtx,
	args: MarkPackageReceiptEmailAttemptArgs
) {
	return getPackageFromDb(ctx, args.packageId).andThen((packageFromDb) => {
		const now = Date.now();

		const sentPatch =
			args.status === "sent"
				? {
						receiptEmailFailureCode: undefined,
						receiptEmailSentAt: now,
						receiptEmailStatus: "sent" as const,
						receiptNumber: args.receiptNumber,
						lastReceiptEmailAttemptAt: now,
						...searchBlobPatchForPackage(packageFromDb, { receiptNumber: args.receiptNumber })
					}
				: {
						receiptEmailFailureCode: args.failureCode,
						receiptEmailStatus: "failed" as const,
						lastReceiptEmailAttemptAt: now
					};

		return okOrThrow(
			ctx.db.patch("packages", args.packageId, sentPatch).then(async () => {
				if (args.status === "sent" && args.receiptNumber) {
					const bookings = await ctx.db
						.query("bookings")
						.withIndex("by_packageId_and_status_and_sessionStartAt", (indexQuery) =>
							indexQuery.eq("packageId", args.packageId)
						)
						.collect();

					await Promise.all(
						bookings.map(async (booking) =>
							ctx.db.patch("bookings", booking._id, {
								receiptNumber: args.receiptNumber,
								...(await searchBlobPatchForBooking(ctx, booking, {
									receiptNumber: args.receiptNumber
								}))
							})
						)
					);
				}

				return null;
			})
		);
	});
}
