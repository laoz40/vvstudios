import { err, ok, type ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx } from "#convex/_generated/server";
import { getMultiBookingExpiresAt } from "#studio/features/booking-form/lib/booking-pricing";
import { getAdminIdentityResult } from "#convex/lib/auth";
import {
	validatePackageInvoiceEmailAttempt,
	type MarkPackageInvoiceEmailAttemptArgs
} from "#convex/lib/bookingInvoiceArtifacts";
import { getPackageFromDb } from "#convex/lib/packageLookup";
import {
	getCapacityConsumingPackageSessions,
	validatePackageScheduleTokenRefresh
} from "#convex/lib/packageScheduling";
import { generateRescheduleToken, hashRescheduleToken } from "#convex/lib/sessionRescheduleLinks";
import {
	buildPackageUpdatePatch,
	parsePackageUpdate,
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
type RefreshScheduleTokenError =
	| PackageLookupError
	| { reason: "PACKAGE_SCHEDULE_EMAIL_NOT_RETRYABLE" }
	| { reason: "PACKAGE_SCHEDULE_LINK_NOT_READY" };
type InvoiceAttemptError =
	| { reason: "INVOICE_NUMBER_REQUIRED" }
	| { reason: "INVOICE_FAILURE_CODE_REQUIRED" };

export function updatePackageService(ctx: MutationCtx, args: UpdatePackageArgs) {
	return getAdminIdentityResult(ctx)
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
	return getAdminIdentityResult(ctx)
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
	return getAdminIdentityResult(ctx)
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
): ResultAsync<PaidPackageResult, PackageLookupError | { reason: "PACKAGE_ALREADY_PAID" }> {
	return getPackageFromDb(ctx, args.multiBookingId)
		.andThen((packageFromDb) => {
			if (packageFromDb.status === "paid" || packageFromDb.status === "schedule_email_failed") {
				return err({ reason: "PACKAGE_ALREADY_PAID" as const });
			}

			return ok(packageFromDb);
		})
		.andThen((packageFromDb) => {
			const token = generateRescheduleToken();
			const expiresAt = getMultiBookingExpiresAt(args.paidAt, packageFromDb.packageSize);

			return okOrThrow(hashRescheduleToken(token)).map((scheduleTokenHash) => ({
				expiresAt,
				packageFromDb,
				scheduleTokenHash,
				token
			}));
		})
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
		}));
}

export function refreshPackageScheduleTokenService(
	ctx: MutationCtx,
	args: PackageIdArgs
): ResultAsync<PaidPackageResult, RefreshScheduleTokenError> {
	return getPackageFromDb(ctx, args.multiBookingId)
		.andThen(validatePackageScheduleTokenRefresh)
		.andThen((packageFromDb) => {
			const token = generateRescheduleToken();
			return okOrThrow(hashRescheduleToken(token)).andThen((scheduleTokenHash) =>
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
		});
}

export function markPackageInvoiceEmailAttemptService(
	ctx: MutationCtx,
	args: MarkPackageInvoiceEmailAttemptArgs
): ResultAsync<null, InvoiceAttemptError> {
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
