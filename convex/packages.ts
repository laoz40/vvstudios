import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { internalMutation, internalQuery, mutation, query } from "#convex/_generated/server";
import { checkBookingSubmitRateLimit } from "#convex/lib/rateLimits";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/lib/booking/bookingAddonQuantities";
import { getPackageFromDb, type PackageLookupError } from "#convex/lib/packages/packageLookup";
import type { PaidPackageResult } from "#convex/lib/packages/packagePayment";
import {
	buildPaidPackageResult,
	patchPackagePaidAfterSchedulingDetails,
	rejectAlreadyPaidPackage,
	schedulePackageAdjustmentAtExpiry
} from "#convex/lib/packages/packagePaidLifecycle";
import { createPackageSchedulingDetails } from "#convex/lib/packages/packageScheduling";
import {
	archivePackageFromAdmin,
	loadAdminPackageUpdateValidation,
	writeAdminPackageFields
} from "#convex/services/packages/packageAdminMutationWorkflow";
import {
	createPendingPackageService,
	listPackagesService
} from "#convex/services/packages/packages";
import {
	createPackageScheduleToken,
	validatePackageScheduleTokenRefresh
} from "#convex/lib/packages/packageScheduling";
import {
	patchPackageSessionBookingsContactSearch,
	searchBlobPatchForBooking,
	searchBlobPatchForPackage
} from "#convex/lib/adminSearch/adminSearchBlob";
import { okOrThrow } from "#convex/lib/result";
import { err, ok } from "neverthrow";

const bookingInvoiceLineItemValidator = v.object({
	amount: v.number(),
	description: v.string(),
	quantity: v.number(),
	rate: v.number()
});

export const checkPackageSubmitRateLimit = internalMutation({
	args: { submitRateLimitKey: v.string() },
	handler: (ctx, args) =>
		checkBookingSubmitRateLimit(ctx, args.submitRateLimitKey).match(tupleOk, tupleErr)
});

export const createPendingPackage = internalMutation({
	args: {
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		duration: v.string(),
		addons: bookingAddonsValidator,
		...bookingAddonQuantitiesValidator,
		notes: v.optional(v.string()),
		packageSize: v.union(v.literal(4), v.literal(8), v.literal(12)),
		singleSessionAmount: v.number(),
		packageSubtotalAmount: v.number(),
		discountPercent: v.number(),
		discountAmount: v.number(),
		totalDueAmount: v.number(),
		invoiceLineItems: v.array(bookingInvoiceLineItemValidator)
	},
	handler: (ctx, args) => createPendingPackageService(ctx, args)
});

export const listPackages = query({
	args: {
		paginationOpts: paginationOptsValidator,
		sortDirection: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
		view: v.optional(v.union(v.literal("inbox"), v.literal("all"))),
		includeStale: v.optional(v.boolean()),
		searchQuery: v.optional(v.string())
	},
	handler: (ctx, args) =>
		listPackagesService(ctx, args).match(
			(packagesPage) => packagesPage,
			(error) => {
				throw new ConvexError(error);
			}
		)
});

export const updatePackageFromAdmin = mutation({
	args: {
		packageId: v.id("packages"),
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		duration: v.string(),
		addons: bookingAddonsValidator,
		...bookingAddonQuantitiesValidator,
		notes: v.optional(v.string()),
		packageSize: v.union(v.literal(4), v.literal(8), v.literal(12)),
		expiresAt: v.optional(v.number())
	},
	handler: (ctx, args) =>
		loadAdminPackageUpdateValidation(ctx, args)
			.andThen((validated) => writeAdminPackageFields(ctx, args, validated))
			.match(tupleOk, tupleErr)
});

export const archivePackage = mutation({
	args: { packageId: v.id("packages"), archived: v.boolean() },
	handler: (ctx, args) => archivePackageFromAdmin(ctx, args).match(tupleOk, tupleErr)
});

export const markPackagePaidAndCreateScheduleToken = internalMutation({
	args: { packageId: v.id("packages"), paidAt: v.number() },
	handler: (
		ctx,
		args
	): Promise<Result<PaidPackageResult, PackageLookupError | { reason: "PACKAGE_ALREADY_PAID" }>> =>
		getPackageFromDb(ctx, args.packageId)
			.andThen(rejectAlreadyPaidPackage)
			.andThen((packageFromDb) => createPackageSchedulingDetails(packageFromDb, args.paidAt))
			.andThen((packageSchedulingDetails) =>
				patchPackagePaidAfterSchedulingDetails(
					ctx,
					args.packageId,
					args.paidAt,
					packageSchedulingDetails
				)
			)
			.andThen((packageSchedulingDetails) =>
				schedulePackageAdjustmentAtExpiry(
					ctx,
					args.packageId,
					packageSchedulingDetails.expiresAt
				).map(() => packageSchedulingDetails)
			)
			.map((packageSchedulingDetails) =>
				buildPaidPackageResult(packageSchedulingDetails, args.paidAt)
			)
			.match(tupleOk, tupleErr)
});

export const refreshPackageScheduleToken = internalMutation({
	args: { packageId: v.id("packages") },
	handler: (ctx, args) =>
		getPackageFromDb(ctx, args.packageId)
			.andThen(validatePackageScheduleTokenRefresh)
			.andThen((packageFromDb) =>
				createPackageScheduleToken().map((scheduleToken) => ({ packageFromDb, ...scheduleToken }))
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
			)
			.match(tupleOk, tupleErr)
});

export const markPackageScheduleEmailAttempt = internalMutation({
	args: { packageId: v.id("packages"), status: v.union(v.literal("sent"), v.literal("failed")) },
	handler: (ctx, args) =>
		getPackageFromDb(ctx, args.packageId)
			.andThen(() =>
				okOrThrow(
					ctx.db
						.patch("packages", args.packageId, {
							status: args.status === "sent" ? "paid" : "schedule_email_failed"
						})
						.then(() => null)
				)
			)
			.match(tupleOk, tupleErr)
});

export const markPackageReceiptEmailAttempt = internalMutation({
	args: {
		packageId: v.id("packages"),
		status: v.union(v.literal("sent"), v.literal("failed")),
		receiptNumber: v.optional(v.string()),
		failureCode: v.optional(v.string())
	},
	handler: (ctx, args) =>
		getPackageFromDb(ctx, args.packageId)
			.andThen((packageFromDb) => {
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
			})
			.match(tupleOk, tupleErr)
});

export const savePackageInstagramHandle = mutation({
	args: { packageId: v.id("packages"), instagramHandle: v.string() },
	handler: (ctx, args) =>
		getPackageFromDb(ctx, args.packageId)
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
			)
			.match(tupleOk, tupleErr)
});

export const getPackageById = internalQuery({
	args: { packageId: v.id("packages") },
	handler: async (ctx, args) => {
		return await ctx.db.get("packages", args.packageId);
	}
});
