import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import { internalMutation, internalQuery, mutation, query } from "#convex/_generated/server";
import { checkBookingSubmitRateLimit } from "#convex/lib/rateLimits";
import {
	archivePackageService,
	createPendingPackageService,
	listPackagesService,
	markPackageInvoiceEmailAttemptService,
	markPackagePaidAndCreateScheduleTokenService,
	markPackageUnpaidService,
	markPackageScheduleEmailAttemptService,
	refreshPackageScheduleTokenService,
	savePackageInstagramHandleService,
	type PackageLookupError,
	type PaidPackageResult,
	updatePackageService
} from "#convex/services/packages";

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
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
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

export const markPackageInvoiceEmailAttempt = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		status: v.union(v.literal("sent"), v.literal("failed")),
		invoiceNumber: v.optional(v.string()),
		failureCode: v.optional(v.string())
	},
	handler: (ctx, args) => markPackageInvoiceEmailAttemptService(ctx, args).match(tupleOk, tupleErr)
});

export const listPackages = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: (ctx, args) =>
		listPackagesService(ctx, args.paginationOpts).match(
			(packagesPage) => packagesPage,
			(error) => {
				throw new ConvexError(error);
			}
		)
});

export const updatePackageFromAdmin = mutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		duration: v.string(),
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		notes: v.optional(v.string()),
		packageSize: v.union(v.literal(4), v.literal(8), v.literal(12)),
		expiresAt: v.optional(v.number()),
		totalDueAmount: v.optional(v.number())
	},
	handler: (ctx, args) => updatePackageService(ctx, args).match(tupleOk, tupleErr)
});

export const archivePackage = mutation({
	args: { multiBookingId: v.id("multiBookingPackages"), archived: v.boolean() },
	handler: (ctx, args) => archivePackageService(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageUnpaid = mutation({
	args: { packageId: v.id("multiBookingPackages") },
	handler: (ctx, args) => markPackageUnpaidService(ctx, args).match(tupleOk, tupleErr)
});

export const markPackagePaidAndCreateScheduleToken = internalMutation({
	args: { multiBookingId: v.id("multiBookingPackages"), paidAt: v.number() },
	handler: (
		ctx,
		args
	): Promise<Result<PaidPackageResult, PackageLookupError | { reason: "PACKAGE_ALREADY_PAID" }>> =>
		markPackagePaidAndCreateScheduleTokenService(ctx, args, (expiresAt) =>
			ctx.scheduler.runAt(expiresAt, internal.packageScheduling.processPackageAdjustmentAtExpiry, {
				multiBookingId: args.multiBookingId,
				expectedExpiresAt: expiresAt
			})
		).match(tupleOk, tupleErr)
});

export const refreshPackageScheduleToken = internalMutation({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => refreshPackageScheduleTokenService(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageScheduleEmailAttempt = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		status: v.union(v.literal("sent"), v.literal("failed"))
	},
	handler: (ctx, args) => markPackageScheduleEmailAttemptService(ctx, args).match(tupleOk, tupleErr)
});

export const savePackageInstagramHandle = mutation({
	args: { multiBookingId: v.id("multiBookingPackages"), instagramHandle: v.string() },
	handler: (ctx, args) => savePackageInstagramHandleService(ctx, args).match(tupleOk, tupleErr)
});

export const getPackageById = internalQuery({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.multiBookingId);
	}
});
