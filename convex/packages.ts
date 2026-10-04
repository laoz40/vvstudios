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
	rejectAlreadyPaidPackage
} from "#convex/lib/packages/packagePaidLifecycle";
import {
	createPackageSchedulingDetailsForPayment,
	recordPackagePaidLifecycle,
	schedulePaidPackageAdjustment
} from "#convex/services/packages/packagePaid";
import {
	archivePackageService,
	createPendingPackageService,
	listPackagesService,
	markPackageReceiptEmailAttemptService,
	markPackageScheduleEmailAttemptService,
	refreshPackageScheduleTokenService,
	savePackageInstagramHandleService,
	updatePackageService
} from "#convex/services/packages/packages";

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
	handler: (ctx, args) => updatePackageService(ctx, args).match(tupleOk, tupleErr)
});

export const archivePackage = mutation({
	args: { packageId: v.id("packages"), archived: v.boolean() },
	handler: (ctx, args) => archivePackageService(ctx, args).match(tupleOk, tupleErr)
});

export const markPackagePaidAndCreateScheduleToken = internalMutation({
	args: { packageId: v.id("packages"), paidAt: v.number() },
	handler: (
		ctx,
		args
	): Promise<Result<PaidPackageResult, PackageLookupError | { reason: "PACKAGE_ALREADY_PAID" }>> =>
		getPackageFromDb(ctx, args.packageId)
			.andThen(rejectAlreadyPaidPackage)
			.andThen((packageFromDb) =>
				createPackageSchedulingDetailsForPayment(packageFromDb, args.paidAt)
			)
			.andThen((packageSchedulingDetails) =>
				recordPackagePaidLifecycle(ctx, args.packageId, args.paidAt, packageSchedulingDetails)
			)
			.andThen((packageSchedulingDetails) =>
				schedulePaidPackageAdjustment(ctx, args.packageId, packageSchedulingDetails.expiresAt).map(
					() => packageSchedulingDetails
				)
			)
			.map((packageSchedulingDetails) =>
				buildPaidPackageResult(packageSchedulingDetails, args.paidAt)
			)
			.match(tupleOk, tupleErr)
});

export const refreshPackageScheduleToken = internalMutation({
	args: { packageId: v.id("packages") },
	handler: (ctx, args) => refreshPackageScheduleTokenService(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageScheduleEmailAttempt = internalMutation({
	args: { packageId: v.id("packages"), status: v.union(v.literal("sent"), v.literal("failed")) },
	handler: (ctx, args) => markPackageScheduleEmailAttemptService(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageReceiptEmailAttempt = internalMutation({
	args: {
		packageId: v.id("packages"),
		status: v.union(v.literal("sent"), v.literal("failed")),
		receiptNumber: v.optional(v.string()),
		failureCode: v.optional(v.string())
	},
	handler: (ctx, args) => markPackageReceiptEmailAttemptService(ctx, args).match(tupleOk, tupleErr)
});

export const savePackageInstagramHandle = mutation({
	args: { packageId: v.id("packages"), instagramHandle: v.string() },
	handler: (ctx, args) => savePackageInstagramHandleService(ctx, args).match(tupleOk, tupleErr)
});

export const getPackageById = internalQuery({
	args: { packageId: v.id("packages") },
	handler: async (ctx, args) => {
		return await ctx.db.get("packages", args.packageId);
	}
});
