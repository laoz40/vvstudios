import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { err, err as tupleErr, ok, ok as tupleOk, type Result } from "#/lib/result";
import { getMultiBookingInvoiceDueAt } from "#studio/features/booking-form/lib/booking-pricing";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	internalMutation,
	internalQuery,
	mutation,
	query,
	type MutationCtx
} from "./_generated/server";
import { getAdminIdentity } from "./lib/auth";
import type { MultiBookingInvoiceSource } from "./lib/bookingInvoiceArtifacts";
import { checkBookingSubmitRateLimit } from "./lib/rateLimits";
import { getCapacityConsumingPackageSessions } from "./lib/packageScheduling";
import {
	archivePackageService,
	markPackageInvoiceEmailAttemptService,
	markPackagePaidAndCreateScheduleTokenService,
	markPackageUnpaidService,
	markPackageScheduleEmailAttemptService,
	refreshPackageScheduleTokenService,
	savePackageInstagramHandleService,
	type PackageLookupError,
	type PaidPackageResult,
	updatePackageService
} from "./services/packages";

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

type CreatePendingPackageResult = Result<
	{ multiBooking: MultiBookingInvoiceSource },
	{ reason: "PACKAGE_CREATE_FAILED" }
>;

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
	handler: async (ctx, args): Promise<CreatePendingPackageResult> => {
		const createdAt = Date.now();
		const invoiceDueAt = getMultiBookingInvoiceDueAt(createdAt);
		const multiBooking = {
			name: args.name,
			phone: args.phone,
			accountName: args.accountName,
			...(args.abn !== undefined ? { abn: args.abn } : {}),
			email: args.email,
			duration: args.duration,
			addons: args.addons,
			...(args.essentialEditQuantity !== undefined
				? { essentialEditQuantity: args.essentialEditQuantity }
				: {}),
			...(args.clipsPackageQuantity !== undefined
				? { clipsPackageQuantity: args.clipsPackageQuantity }
				: {}),
			...(args.notes !== undefined ? { notes: args.notes } : {}),
			packageSize: args.packageSize,
			singleSessionAmount: args.singleSessionAmount,
			packageSubtotalAmount: args.packageSubtotalAmount,
			discountPercent: args.discountPercent,
			discountAmount: args.discountAmount,
			totalDueAmount: args.totalDueAmount,
			invoiceLineItems: args.invoiceLineItems,
			status: "pending_payment" as const,
			createdAt,
			invoiceDueAt,
			invoiceEmailStatus: "pending" as const
		};

		try {
			const multiBookingId = await ctx.db.insert("multiBookingPackages", multiBooking);

			return ok({ multiBooking: { _id: multiBookingId, ...multiBooking } });
		} catch {
			return err({ reason: "PACKAGE_CREATE_FAILED" });
		}
	}
});

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
	args: { multiBookingId: Id<"multiBookingPackages">; archived: boolean }
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

export const savePackageInstagramHandle = mutation({
	args: { multiBookingId: v.id("multiBookingPackages"), instagramHandle: v.string() },
	handler: (ctx, args) => savePackageInstagramHandleHandler(ctx, args)
});

function savePackageInstagramHandleHandler(
	ctx: MutationCtx,
	args: { multiBookingId: Id<"multiBookingPackages">; instagramHandle: string }
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
