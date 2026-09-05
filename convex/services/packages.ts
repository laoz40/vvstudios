import type { PaginationOptions } from "convex/server";
import { err, ok } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { requirePermission } from "#convex/lib/auth";
import {
	validatePackageInvoiceEmailAttempt,
	type MarkPackageInvoiceEmailAttemptArgs
} from "#convex/lib/bookingInvoiceArtifacts";
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
import { okOrThrow } from "#convex/lib/result";

type SavePackageInstagramHandleArgs = {
	multiBookingId: Id<"multiBookingPackages">;
	instagramHandle: string;
};
type ArchivePackageArgs = { multiBookingId: Id<"multiBookingPackages">; archived: boolean };
type PackageIdArgs = { multiBookingId: Id<"multiBookingPackages"> };
type MarkPackageUnpaidArgs = { packageId: Id<"multiBookingPackages"> };
type MarkPackagePaidArgs = PackageIdArgs & { paidAt: number };
type MarkPackageScheduleEmailAttemptArgs = PackageIdArgs & { status: "sent" | "failed" };
export type PackageLookupError = { reason: "PACKAGE_NOT_FOUND" };
export type PaidPackageResult = {
	expiresAt: number;
	paidAt: number;
	multiBooking: Doc<"multiBookingPackages">;
	token: string;
};
export function createPendingPackageService(ctx: MutationCtx, args: CreatePendingPackageArgs) {
	const createdAt = Date.now();
	const packageRecord = buildPendingPackageRecord(
		{ ...args, email: args.email.trim().toLowerCase() },
		createdAt
	);

	return ctx.db
		.insert("multiBookingPackages", packageRecord)
		.then((packageId) => ({ multiBooking: { _id: packageId, ...packageRecord } }));
}

export function listPackagesService(ctx: QueryCtx, paginationOpts: PaginationOptions) {
	return requirePermission(ctx, "view:packages")
		.andThen(() =>
			okOrThrow(
				ctx.db
					.query("multiBookingPackages")
					.withIndex("by_createdAt")
					.order("desc")
					.paginate(paginationOpts)
			)
		)
		.andThen((packagesPage) =>
			okOrThrow(
				Promise.all(
					packagesPage.page.map(async (packageFromDb) => {
						const [packageSessions, packageAdjustment] = await Promise.all([
							getCapacityConsumingPackageSessions(
								ctx,
								packageFromDb._id,
								packageFromDb.packageSize
							),
							ctx.db
								.query("packageAdjustments")
								.withIndex("by_multiBookingId", (indexQuery) =>
									indexQuery.eq("multiBookingId", packageFromDb._id)
								)
								.unique()
						]);

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
									: null
						};
					})
				).then((page) => ({ ...packagesPage, page }))
			)
		);
}

export function updatePackageService(ctx: MutationCtx, args: UpdatePackageArgs) {
	return requirePermission(ctx, "edit:sessions")
		.andThen(() => getPackageFromDb(ctx, args.multiBookingId))
		.andThen((existingPackage) =>
			parsePackageUpdate(args).map((updatedPackage) => ({ existingPackage, updatedPackage }))
		)
		.andThen(({ existingPackage, updatedPackage }) =>
			okOrThrow(
				getCapacityConsumingPackageSessions(ctx, existingPackage._id, existingPackage.packageSize)
			).map((activeBookedSessions) => ({ activeBookedSessions, updatedPackage }))
		)
		.andThen(({ activeBookedSessions, updatedPackage }) =>
			validatePackageUpdate(args, updatedPackage, activeBookedSessions.length)
		)
		.andThen((updatedPackage) =>
			okOrThrow(
				ctx.db
					.patch(args.multiBookingId, buildPackageUpdatePatch(args, updatedPackage))
					.then(() => null)
			)
		);
}

export function savePackageInstagramHandleService(
	ctx: MutationCtx,
	args: SavePackageInstagramHandleArgs
) {
	return getPackageFromDb(ctx, args.multiBookingId)
		.andThen((packageFromDb) => {
			if (packageFromDb.status !== "pending_payment" && packageFromDb.status !== "paid") {
				return err({ reason: "PACKAGE_NOT_ACTIVE" as const });
			}
			return ok(packageFromDb);
		})
		.andThen((packageFromDb) =>
			okOrThrow(
				ctx.db.patch(packageFromDb._id, { instagramHandle: args.instagramHandle }).then(() => null)
			)
		);
}

export function archivePackageService(ctx: MutationCtx, args: ArchivePackageArgs) {
	return requirePermission(ctx, "archive:sessions")
		.andThen(() => getPackageFromDb(ctx, args.multiBookingId))
		.andThen(() =>
			okOrThrow(
				ctx.db
					.patch(args.multiBookingId, { hiddenAt: args.archived ? Date.now() : undefined })
					.then(() => null)
			)
		);
}

export function markPackageUnpaidService(ctx: MutationCtx, args: MarkPackageUnpaidArgs) {
	return requirePermission(ctx, "update:payment-status")
		.andThen(() => getPackageFromDb(ctx, args.packageId))
		.andThen((packageFromDb) =>
			okOrThrow(
				ctx.db
					.patch(args.packageId, {
						paidAt: undefined,
						expiresAt: undefined,
						packageReminderState: undefined,
						scheduleTokenHash: undefined,
						scheduleLinkStatus: undefined,
						status:
							packageFromDb.invoiceEmailStatus === "failed"
								? "invoice_email_failed"
								: "pending_payment"
					})
					.then(() => null)
			)
		);
}

export function markPackagePaidAndCreateScheduleTokenService(
	ctx: MutationCtx,
	args: MarkPackagePaidArgs,
	scheduleExpiry: (expiresAt: number) => Promise<unknown>
) {
	return (
		getPackageFromDb(ctx, args.multiBookingId)
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
						.patch(args.multiBookingId, {
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
				multiBooking: {
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
	return getPackageFromDb(ctx, args.multiBookingId)
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
					.patch(args.multiBookingId, { scheduleLinkStatus: "active", scheduleTokenHash })
					.then(() => ({
						expiresAt: packageFromDb.expiresAt,
						paidAt: packageFromDb.paidAt,
						multiBooking: {
							...packageFromDb,
							scheduleLinkStatus: "active" as const,
							scheduleTokenHash
						},
						token
					}))
			)
		);
}

export function markPackageInvoiceEmailAttemptService(
	ctx: MutationCtx,
	args: MarkPackageInvoiceEmailAttemptArgs
) {
	return validatePackageInvoiceEmailAttempt(args).asyncAndThen(() => {
		const now = Date.now();
		const patch =
			args.status === "sent"
				? {
						invoiceNumber: args.invoiceNumber,
						invoiceEmailStatus: args.status,
						invoiceEmailSentAt: now,
						invoiceEmailFailureCode: undefined,
						lastInvoiceEmailAttemptAt: now,
						status: "pending_payment" as const
					}
				: {
						invoiceNumber: undefined,
						invoiceEmailStatus: args.status,
						invoiceEmailSentAt: undefined,
						invoiceEmailFailureCode: args.failureCode,
						lastInvoiceEmailAttemptAt: now,
						status: "invoice_email_failed" as const
					};

		return okOrThrow(ctx.db.patch(args.multiBookingId, patch).then(() => null));
	});
}

export function markPackageScheduleEmailAttemptService(
	ctx: MutationCtx,
	args: MarkPackageScheduleEmailAttemptArgs
) {
	return getPackageFromDb(ctx, args.multiBookingId).andThen(() =>
		okOrThrow(
			ctx.db
				.patch(args.multiBookingId, {
					status: args.status === "sent" ? "paid" : "schedule_email_failed"
				})
				.then(() => null)
		)
	);
}
