import type { PaginationOptions } from "convex/server";
import { err, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { setPackageArchived } from "#convex/lib/archiveState";
import { requirePermission } from "#convex/lib/auth";
import { getPackageFromDb } from "#convex/lib/packageLookup";
import {
	createPackageScheduleToken,
	createPackageSchedulingDetails,
	getCapacityConsumingPackageSessions,
	validatePackageScheduleTokenRefresh
} from "#convex/lib/packageScheduling";
import {
	buildPendingPackageRecord,
	buildPackageUpdatePatch,
	parsePackageUpdate,
	type CreatePendingPackageArgs,
	type UpdatePackageArgs,
	validatePackageUpdate
} from "#convex/lib/packageUpdates";
import {
	paginateAdminPackagesWithoutSearch,
	paginateAdminPackagesWithSearch,
	type AdminPackageSearchArgs
} from "#convex/lib/adminPackageSearch";
import { parseTrimmedAdminSearchQuery } from "#convex/lib/adminSearchQuery";
import {
	searchBlobPatchForBooking,
	searchBlobPatchForPackage,
	patchPackageSessionBookingsContactSearch,
	type PackageContactSearchFields
} from "#convex/lib/adminSearchBlob";
import {
	passesAdminPackageStaleFilter,
	type AdminPackagesView
} from "#convex/lib/adminPackageList";
import { okOrThrow } from "#convex/lib/result";
import {
	listStripeInvoicesForPackage,
	summarizeCustomPackageStripeInvoices
} from "#convex/lib/stripeInvoices";

type SavePackageInstagramHandleArgs = { packageId: Id<"packages">; instagramHandle: string };

type ArchivePackageArgs = { packageId: Id<"packages">; archived: boolean };

type PackageIdArgs = { packageId: Id<"packages"> };

type MarkPackagePaidArgs = PackageIdArgs & { paidAt: number };

type MarkPackageScheduleEmailAttemptArgs = PackageIdArgs & { status: "sent" | "failed" };

type MarkPackageReceiptEmailAttemptArgs = PackageIdArgs & {
	status: "sent" | "failed";
	receiptNumber?: string;
	failureCode?: string;
};

export type PackageLookupError = { reason: "PACKAGE_NOT_FOUND" };

export type PaidPackageResult = {
	expiresAt: number;
	paidAt: number;
	packageRecord: Doc<"packages">;
	token: string;
};

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

async function loadAdminPackageListRows(ctx: QueryCtx, packagesOnPage: Doc<"packages">[]) {
	return Promise.all(
		packagesOnPage.map(async (packageFromDb) => {
			const [packageSessions, packageAdjustment, stripeInvoicesResult] = await Promise.all([
				getCapacityConsumingPackageSessions(ctx, packageFromDb._id, packageFromDb.packageSize),
				ctx.db
					.query("packageAdjustments")
					.withIndex("by_packageId", (indexQuery) => indexQuery.eq("packageId", packageFromDb._id))
					.unique(),
				listStripeInvoicesForPackage(ctx, packageFromDb._id)
			]);

			const customStripeInvoicesSummary = summarizeCustomPackageStripeInvoices(
				stripeInvoicesResult.unwrapOr([])
			);

			return {
				...packageFromDb,
				bookedSessions: packageSessions.length,
				// An adjustment record (including no-charge) is created only after all sessions end.
				areSessionsComplete: packageAdjustment !== null,
				adjustment:
					packageAdjustment?.outcome === "invoice_required"
						? {
								_id: packageAdjustment._id,
								totalAmount: packageAdjustment.totalAmount,
								invoiceDueAt: packageAdjustment.invoiceDueAt,
								invoiceEmailStatus: packageAdjustment.invoiceEmailStatus,
								paymentStatus: packageAdjustment.paymentStatus
							}
						: null,
				customStripeInvoicesSummary
			};
		})
	);
}

async function buildAdminPackagesListPage(ctx: QueryCtx, args: ListPackagesArgs) {
	const sortDirection = args.sortDirection ?? "desc";
	const view = args.view ?? "inbox";
	const includeStale = args.includeStale ?? false;
	const parsedSearchQuery = parseTrimmedAdminSearchQuery(args.searchQuery);

	const searchContext: Omit<AdminPackageSearchArgs, "parsedQuery"> = {
		sortDirection,
		view,
		includeStale,
		paginationOpts: args.paginationOpts
	};

	const packagesPage = parsedSearchQuery
		? await paginateAdminPackagesWithSearch(ctx, {
				...searchContext,
				parsedQuery: parsedSearchQuery
			})
		: await paginateAdminPackagesWithoutSearch(ctx, searchContext);

	const packagesOnPage = !includeStale
		? packagesPage.page.filter((packageFromDb) =>
				passesAdminPackageStaleFilter(packageFromDb, includeStale)
			)
		: packagesPage.page;

	const page = await loadAdminPackageListRows(ctx, packagesOnPage);

	return { ...packagesPage, page };
}

export function listPackagesService(ctx: QueryCtx, args: ListPackagesArgs) {
	return requirePermission(ctx, "view:packages").andThen(() =>
		okOrThrow(buildAdminPackagesListPage(ctx, args))
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
					.patch(args.packageId, {
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
					.patch(packageFromDb._id, {
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

export function markPackagePaidAndCreateScheduleTokenService(
	ctx: MutationCtx,
	args: MarkPackagePaidArgs,
	scheduleExpiry: (expiresAt: number) => Promise<Id<"_scheduled_functions">>
) {
	return (
		getPackageFromDb(ctx, args.packageId)
			// Reject packages that have already entered their paid lifecycle.
			.andThen((packageFromDb) => {
				if (packageFromDb.status === "paid" || packageFromDb.status === "schedule_email_failed") {
					return err({ reason: "PACKAGE_ALREADY_PAID" as const });
				}

				return ok(packageFromDb);
			})
			// Generate the scheduling token and calculate the package expiry.
			.andThen((packageFromDb) =>
				okOrThrow(createPackageSchedulingDetails(packageFromDb, args.paidAt))
			)
			// Persist the package's paid scheduling lifecycle.
			.andThen((packageSchedulingDetails) =>
				okOrThrow(
					ctx.db
						.patch(args.packageId, {
							expiresAt: packageSchedulingDetails.expiresAt,
							paidAt: args.paidAt,
							packageReminderState: undefined,
							scheduleLinkStatus: "active",
							scheduleTokenHash: packageSchedulingDetails.scheduleTokenHash,
							status: "schedule_email_failed"
						})
						.then(() => packageSchedulingDetails)
				)
			)
			// Schedule the package-expiry adjustment check.
			.andThen((packageSchedulingDetails) =>
				okOrThrow(
					scheduleExpiry(packageSchedulingDetails.expiresAt).then(() => packageSchedulingDetails)
				)
			)
			.map((packageSchedulingDetails) => ({
				expiresAt: packageSchedulingDetails.expiresAt,
				paidAt: args.paidAt,
				packageRecord: {
					...packageSchedulingDetails.packageFromDb,
					expiresAt: packageSchedulingDetails.expiresAt,
					paidAt: args.paidAt,
					scheduleLinkStatus: "active" as const,
					scheduleTokenHash: packageSchedulingDetails.scheduleTokenHash,
					status: "schedule_email_failed" as const
				},
				token: packageSchedulingDetails.token
			}))
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
					.patch(args.packageId, { scheduleLinkStatus: "active", scheduleTokenHash })
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
				.patch(args.packageId, {
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
			ctx.db.patch(args.packageId, sentPatch).then(async () => {
				if (args.status === "sent" && args.receiptNumber) {
					const bookings = await ctx.db
						.query("bookings")
						.withIndex("by_packageId", (indexQuery) => indexQuery.eq("packageId", args.packageId))
						.collect();

					await Promise.all(
						bookings.map(async (booking) =>
							ctx.db.patch(booking._id, {
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
