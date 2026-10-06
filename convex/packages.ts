import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, internalQuery, mutation, query } from "#convex/_generated/server";
import {
	bookingAddonQuantitiesValidator,
	bookingAddonsValidator
} from "#convex/services/booking/bookingFormValidators";
import {
	archivePackageFromAdmin,
	loadAdminPackageUpdateValidation,
	writeAdminPackageFields
} from "#convex/services/packages/packageAdminMutations";
import { listAdminPackagesPage } from "#convex/services/packages/packageAdminQueries";
import {
	enforcePackageSubmitRateLimit,
	insertPendingPackageRecord,
	loadPackageEligibleForInstagramUpdate,
	queryPackageByIdOrNull,
	markPackagePaidWithScheduleToken,
	refreshPaidPackageScheduleToken,
	savePackageInstagramHandle as applyPackageInstagramHandleUpdate,
	writePackageReceiptEmailAttempt,
	writePackageScheduleEmailAttempt
} from "#convex/services/packages/packageInternalMutations";

const packageInvoiceLineItemValidator = v.object({
	amount: v.number(),
	description: v.string(),
	quantity: v.number(),
	rate: v.number()
});

export const checkPackageSubmitRateLimit = internalMutation({
	args: { submitRateLimitKey: v.string() },
	handler: (ctx, args) =>
		enforcePackageSubmitRateLimit(ctx, args.submitRateLimitKey).match(tupleOk, tupleErr)
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
		invoiceLineItems: v.array(packageInvoiceLineItemValidator)
	},
	handler: (ctx, args) => insertPendingPackageRecord(ctx, args).match(tupleOk, tupleErr)
});

export const listPackages = query({
	args: {
		paginationOpts: paginationOptsValidator,
		sortDirection: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
		view: v.optional(v.union(v.literal("inbox"), v.literal("all"))),
		includeStale: v.optional(v.boolean()),
		searchQuery: v.optional(v.string())
	},
	handler: (ctx, args) => listAdminPackagesPage(ctx, args)
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
	handler: (ctx, args) => markPackagePaidWithScheduleToken(ctx, args).match(tupleOk, tupleErr)
});

export const refreshPackageScheduleToken = internalMutation({
	args: { packageId: v.id("packages") },
	handler: (ctx, args) =>
		refreshPaidPackageScheduleToken(ctx, args.packageId).match(tupleOk, tupleErr)
});

export const markPackageScheduleEmailAttempt = internalMutation({
	args: { packageId: v.id("packages"), status: v.union(v.literal("sent"), v.literal("failed")) },
	handler: (ctx, args) => writePackageScheduleEmailAttempt(ctx, args).match(tupleOk, tupleErr)
});

export const markPackageReceiptEmailAttempt = internalMutation({
	args: {
		packageId: v.id("packages"),
		status: v.union(v.literal("sent"), v.literal("failed")),
		receiptNumber: v.optional(v.string()),
		failureCode: v.optional(v.string())
	},
	handler: (ctx, args) => writePackageReceiptEmailAttempt(ctx, args).match(tupleOk, tupleErr)
});

export const savePackageInstagramHandle = mutation({
	args: { packageId: v.id("packages"), instagramHandle: v.string() },
	handler: (ctx, args) =>
		loadPackageEligibleForInstagramUpdate(ctx, args.packageId)
			.andThen((packageFromDb) =>
				applyPackageInstagramHandleUpdate(ctx, {
					packageFromDb,
					instagramHandle: args.instagramHandle
				})
			)
			.match(tupleOk, tupleErr)
});

export const getPackageById = internalQuery({
	args: { packageId: v.id("packages") },
	handler: (ctx, args) => queryPackageByIdOrNull(ctx, args.packageId)
});
