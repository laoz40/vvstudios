import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { err as tupleErr, ok as tupleOk, type Result } from "#/lib/result";
import { internal } from "#convex/_generated/api";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
	type MutationCtx
} from "#convex/_generated/server";
import { getAdminIdentity } from "#convex/lib/auth";
import { getCapacityConsumingPackageSessions } from "#convex/lib/packageScheduling";
import { checkBookingSubmitRateLimit } from "#convex/lib/rateLimits";
import {
	archivePackageService,
	createPendingPackageService,
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
	handler: (ctx, args) => checkBookingSubmitRateLimit(ctx, args.submitRateLimitKey)
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
	handler: (ctx, args) => createPendingPackageHandler(ctx, args)
});

function createPendingPackageHandler(
	ctx: MutationCtx,
	args: Parameters<typeof createPendingPackageService>[1]
) {
	return createPendingPackageService(ctx, args).match(tupleOk, tupleErr);
}

export type CreatePendingPackageResult = Awaited<ReturnType<typeof createPendingPackageHandler>>;

export const markPackageInvoiceEmailAttempt = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		status: v.union(v.literal("sent"), v.literal("failed")),
		invoiceNumber: v.optional(v.string()),
		failureCode: v.optional(v.string())
	},
	handler: (ctx, args) => markPackageInvoiceEmailAttemptHandler(ctx, args)
});

function markPackageInvoiceEmailAttemptHandler(
	ctx: MutationCtx,
	args: Parameters<typeof markPackageInvoiceEmailAttemptService>[1]
) {
	return markPackageInvoiceEmailAttemptService(ctx, args).match(tupleOk, tupleErr);
}

export const listPackages = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		const [authError] = await getAdminIdentity(ctx);

		if (authError !== null) {
			throw new ConvexError(authError);
		}

		const packagesPage = await ctx.db
			.query("multiBookingPackages")
			.withIndex("by_createdAt")
			.order("desc")
			.paginate(args.paginationOpts);

		const page = await Promise.all(
			packagesPage.page.map(async (multiBookingPackage) => {
				const [bookings, packageAdjustment] = await Promise.all([
					getCapacityConsumingPackageSessions(
						ctx,
						multiBookingPackage._id,
						multiBookingPackage.packageSize
					),
					ctx.db
						.query("packageAdjustments")
						.withIndex("by_multiBookingId", (indexQuery) =>
							indexQuery.eq("multiBookingId", multiBookingPackage._id)
						)
						.unique()
				]);

				return {
					...multiBookingPackage,
					bookedSessions: bookings.length,
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
		);

		return { ...packagesPage, page };
	}
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
	handler: (ctx, args) => updatePackageFromAdminHandler(ctx, args)
});

function updatePackageFromAdminHandler(
	ctx: MutationCtx,
	args: Parameters<typeof updatePackageService>[1]
) {
	return updatePackageService(ctx, args).match(tupleOk, tupleErr);
}

export type UpdatePackageFromAdminResult = Awaited<
	ReturnType<typeof updatePackageFromAdminHandler>
>;

export const archivePackage = mutation({
	args: { multiBookingId: v.id("multiBookingPackages"), archived: v.boolean() },
	handler: (ctx, args) => archivePackageHandler(ctx, args)
});

function archivePackageHandler(
	ctx: MutationCtx,
	args: Parameters<typeof archivePackageService>[1]
) {
	return archivePackageService(ctx, args).match(tupleOk, tupleErr);
}

export type ArchivePackageResult = Awaited<ReturnType<typeof archivePackageHandler>>;

export const markPackageUnpaid = mutation({
	args: { packageId: v.id("multiBookingPackages") },
	handler: (ctx, args) => markPackageUnpaidHandler(ctx, args)
});

function markPackageUnpaidHandler(
	ctx: MutationCtx,
	args: Parameters<typeof markPackageUnpaidService>[1]
) {
	return markPackageUnpaidService(ctx, args).match(tupleOk, tupleErr);
}

export type MarkPackageUnpaidResult = Awaited<ReturnType<typeof markPackageUnpaidHandler>>;

export const markPackagePaidAndCreateScheduleToken = internalMutation({
	args: { multiBookingId: v.id("multiBookingPackages"), paidAt: v.number() },
	handler: (ctx, args) => markPackagePaidAndCreateScheduleTokenHandler(ctx, args)
});

function markPackagePaidAndCreateScheduleTokenHandler(
	ctx: MutationCtx,
	args: Parameters<typeof markPackagePaidAndCreateScheduleTokenService>[1]
): Promise<Result<PaidPackageResult, PackageLookupError | { reason: "PACKAGE_ALREADY_PAID" }>> {
	return markPackagePaidAndCreateScheduleTokenService(ctx, args, (expiresAt) =>
		ctx.scheduler.runAt(expiresAt, internal.packageScheduling.processPackageAdjustmentAtExpiry, {
			multiBookingId: args.multiBookingId,
			expectedExpiresAt: expiresAt
		})
	).match(tupleOk, tupleErr);
}

export type MarkPackagePaidAndCreateScheduleTokenResult = Awaited<
	ReturnType<typeof markPackagePaidAndCreateScheduleTokenHandler>
>;

export const refreshPackageScheduleToken = internalMutation({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => refreshPackageScheduleTokenHandler(ctx, args)
});

function refreshPackageScheduleTokenHandler(
	ctx: MutationCtx,
	args: Parameters<typeof refreshPackageScheduleTokenService>[1]
) {
	return refreshPackageScheduleTokenService(ctx, args).match(tupleOk, tupleErr);
}

export type RefreshPackageScheduleTokenResult = Awaited<
	ReturnType<typeof refreshPackageScheduleTokenHandler>
>;

export const markPackageScheduleEmailAttempt = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		status: v.union(v.literal("sent"), v.literal("failed"))
	},
	handler: (ctx, args) => markPackageScheduleEmailAttemptHandler(ctx, args)
});

function markPackageScheduleEmailAttemptHandler(
	ctx: MutationCtx,
	args: Parameters<typeof markPackageScheduleEmailAttemptService>[1]
) {
	return markPackageScheduleEmailAttemptService(ctx, args).match(tupleOk, tupleErr);
}

export type MarkPackageScheduleEmailAttemptResult = Awaited<
	ReturnType<typeof markPackageScheduleEmailAttemptHandler>
>;

export const savePackageInstagramHandle = mutation({
	args: { multiBookingId: v.id("multiBookingPackages"), instagramHandle: v.string() },
	handler: (ctx, args) => savePackageInstagramHandleHandler(ctx, args)
});

function savePackageInstagramHandleHandler(
	ctx: MutationCtx,
	args: Parameters<typeof savePackageInstagramHandleService>[1]
) {
	return savePackageInstagramHandleService(ctx, args).match(tupleOk, tupleErr);
}

export type SavePackageInstagramHandleResult = Awaited<
	ReturnType<typeof savePackageInstagramHandleHandler>
>;

export const getPackageById = internalQuery({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.multiBookingId);
	}
});
