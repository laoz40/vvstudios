import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { err, err as tupleErr, ok, ok as tupleOk, type Result } from "../src/lib/result";
import { multiBookingFormSchema } from "../src/sites/studio/features/booking-form/lib/booking-form-model";
import {
	calculateMultiBookingAmounts,
	getMultiBookingExpiresAt,
	getMultiBookingInvoiceDueAt,
	type MultiBookingSize
} from "../src/sites/studio/features/booking-form/lib/booking-pricing";
import { createMultiBookingInvoiceLineItemSnapshot } from "../src/sites/studio/features/booking-invoice/lib/build-booking-invoice-data";
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
import { generateRescheduleToken, hashRescheduleToken } from "./lib/sessionRescheduleLinks";
import {
	getCapacityConsumingPackageSessions,
	getPackageAdminUpdateValidationError
} from "./lib/packageScheduling";
import { archivePackageService } from "./services/packages";

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
	handler: async (ctx, args) => {
		const now = Date.now();

		if (args.status === "sent" && args.invoiceNumber === undefined) {
			return err({ reason: "INVOICE_NUMBER_REQUIRED" });
		}

		if (args.status === "failed" && args.failureCode === undefined) {
			return err({ reason: "INVOICE_FAILURE_CODE_REQUIRED" });
		}

		if (args.status === "sent") {
			await ctx.db.patch(args.multiBookingId, {
				invoiceNumber: args.invoiceNumber,
				invoiceEmailStatus: args.status,
				invoiceEmailSentAt: now,
				invoiceEmailFailureCode: undefined,
				lastInvoiceEmailAttemptAt: now,
				status: "pending_payment"
			});

			return ok({ updated: true });
		}

		await ctx.db.patch(args.multiBookingId, {
			invoiceNumber: undefined,
			invoiceEmailStatus: args.status,
			invoiceEmailSentAt: undefined,
			invoiceEmailFailureCode: args.failureCode,
			lastInvoiceEmailAttemptAt: now,
			status: "invoice_email_failed"
		});

		return ok({ updated: true });
	}
});

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

type UpdatePackageFromAdminArgs = {
	multiBookingId: Id<"multiBookingPackages">;
	name: string;
	phone: string;
	accountName: string;
	abn?: string;
	email: string;
	duration: string;
	addons: string[];
	essentialEditQuantity?: string;
	clipsPackageQuantity?: string;
	notes?: string;
	packageSize: MultiBookingSize;
	expiresAt?: number;
	totalDueAmount?: number;
};

async function updatePackageFromAdminHandler(ctx: MutationCtx, args: UpdatePackageFromAdminArgs) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const multiBooking = await ctx.db.get(args.multiBookingId);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	const parsedMultiBooking = multiBookingFormSchema.safeParse({
		...args,
		essentialEditQuantity: args.essentialEditQuantity ?? "",
		clipsPackageQuantity: args.clipsPackageQuantity ?? "",
		notes: args.notes ?? ""
	});

	if (!parsedMultiBooking.success) {
		return err({ reason: "INVALID_BOOKING_DATA" });
	}

	const multiBookingData = parsedMultiBooking.data;
	const activeBookedSessions = await getCapacityConsumingPackageSessions(
		ctx,
		multiBooking._id,
		multiBooking.packageSize
	);

	const validationError = getPackageAdminUpdateValidationError(
		args,
		activeBookedSessions.length,
		multiBookingData.packageSize
	);

	if (validationError !== null) {
		return err({ reason: validationError });
	}

	const amounts = calculateMultiBookingAmounts({
		addons: multiBookingData.addons,
		clipsPackageQuantity: multiBookingData.clipsPackageQuantity,
		duration: multiBookingData.duration,
		essentialEditQuantity: multiBookingData.essentialEditQuantity,
		packageSize: multiBookingData.packageSize
	});
	const invoiceLineItems = createMultiBookingInvoiceLineItemSnapshot({
		addons: multiBookingData.addons,
		clipsPackageQuantity: multiBookingData.clipsPackageQuantity,
		discountAmount: amounts.discountAmount,
		discountPercent: amounts.discountPercent,
		duration: multiBookingData.duration,
		essentialEditQuantity: multiBookingData.essentialEditQuantity,
		packageSize: multiBookingData.packageSize
	});

	try {
		await ctx.db.patch(args.multiBookingId, {
			name: multiBookingData.name,
			phone: multiBookingData.phone,
			accountName: multiBookingData.accountName,
			abn: multiBookingData.abn,
			email: multiBookingData.email,
			duration: multiBookingData.duration,
			addons: multiBookingData.addons,
			essentialEditQuantity: multiBookingData.essentialEditQuantity,
			clipsPackageQuantity: multiBookingData.clipsPackageQuantity,
			notes: multiBookingData.notes,
			packageSize: multiBookingData.packageSize,
			...(args.expiresAt !== undefined ? { expiresAt: args.expiresAt } : {}),
			singleSessionAmount: amounts.singleSessionAmount,
			packageSubtotalAmount: amounts.packageSubtotalAmount,
			discountPercent: amounts.discountPercent,
			discountAmount: amounts.discountAmount,
			totalDueAmount: args.totalDueAmount ?? amounts.totalDueAmount,
			invoiceLineItems
		});
	} catch {
		return err({ reason: "PACKAGE_UPDATE_FAILED" });
	}

	return ok({ saved: true });
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

export const markPackagePaymentStatus = mutation({
	args: { multiBookingId: v.id("multiBookingPackages"), paid: v.boolean() },
	handler: (ctx, args) => markPackagePaymentStatusHandler(ctx, args)
});

async function markPackagePaymentStatusHandler(
	ctx: MutationCtx,
	args: { multiBookingId: Id<"multiBookingPackages">; paid: boolean }
) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const multiBooking = await ctx.db.get(args.multiBookingId);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	if (args.paid) {
		return err({ reason: "PACKAGE_PAYMENT_CONFIRMATION_REQUIRED" });
	}

	try {
		await ctx.db.patch(args.multiBookingId, {
			paidAt: undefined,
			expiresAt: undefined,
			packageReminderState: undefined,
			scheduleTokenHash: undefined,
			scheduleLinkStatus: undefined,
			status:
				multiBooking.invoiceEmailStatus === "failed" ? "invoice_email_failed" : "pending_payment"
		});
	} catch {
		return err({ reason: "PACKAGE_PAYMENT_STATUS_UPDATE_FAILED" });
	}

	return ok({ paid: false });
}

export type MarkPackagePaymentStatusResult = Awaited<
	ReturnType<typeof markPackagePaymentStatusHandler>
>;

export const markPackagePaidAndCreateScheduleToken = internalMutation({
	args: { multiBookingId: v.id("multiBookingPackages"), paidAt: v.number() },
	handler: (ctx, args) => markPackagePaidAndCreateScheduleTokenHandler(ctx, args)
});

async function markPackagePaidAndCreateScheduleTokenHandler(
	ctx: MutationCtx,
	args: { multiBookingId: Id<"multiBookingPackages">; paidAt: number }
) {
	const multiBooking = await ctx.db.get(args.multiBookingId);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	if (multiBooking.status === "paid" || multiBooking.status === "schedule_email_failed") {
		return err({ reason: "PACKAGE_ALREADY_PAID" });
	}

	const token = generateRescheduleToken();
	const scheduleTokenHash = await hashRescheduleToken(token);
	const expiresAt = getMultiBookingExpiresAt(args.paidAt, multiBooking.packageSize);

	try {
		await ctx.db.patch(args.multiBookingId, {
			expiresAt,
			paidAt: args.paidAt,
			packageReminderState: undefined,
			scheduleLinkStatus: "active",
			scheduleTokenHash,
			status: "schedule_email_failed"
		});
		await ctx.scheduler.runAt(
			expiresAt,
			internal.packageScheduling.processPackageAdjustmentAtExpiry,
			{ multiBookingId: args.multiBookingId, expectedExpiresAt: expiresAt }
		);
	} catch {
		return err({ reason: "PACKAGE_PAYMENT_STATUS_UPDATE_FAILED" });
	}

	return ok({
		expiresAt,
		paidAt: args.paidAt,
		multiBooking: {
			...multiBooking,
			expiresAt,
			paidAt: args.paidAt,
			scheduleLinkStatus: "active" as const,
			scheduleTokenHash,
			status: "schedule_email_failed" as const
		},
		token
	});
}

export type MarkPackagePaidAndCreateScheduleTokenResult = Awaited<
	ReturnType<typeof markPackagePaidAndCreateScheduleTokenHandler>
>;

export const refreshPackageScheduleToken = internalMutation({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => refreshPackageScheduleTokenHandler(ctx, args)
});

async function refreshPackageScheduleTokenHandler(
	ctx: MutationCtx,
	args: { multiBookingId: Id<"multiBookingPackages"> }
) {
	const multiBooking = await ctx.db.get(args.multiBookingId);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	if (multiBooking.status !== "paid" && multiBooking.status !== "schedule_email_failed") {
		return err({ reason: "PACKAGE_SCHEDULE_EMAIL_NOT_RETRYABLE" });
	}

	if (multiBooking.paidAt === undefined || multiBooking.expiresAt === undefined) {
		return err({ reason: "PACKAGE_SCHEDULE_LINK_NOT_READY" });
	}

	const token = generateRescheduleToken();
	const scheduleTokenHash = await hashRescheduleToken(token);

	try {
		await ctx.db.patch(args.multiBookingId, { scheduleLinkStatus: "active", scheduleTokenHash });
	} catch {
		return err({ reason: "PACKAGE_SCHEDULE_TOKEN_UPDATE_FAILED" });
	}

	return ok({
		expiresAt: multiBooking.expiresAt,
		paidAt: multiBooking.paidAt,
		multiBooking: { ...multiBooking, scheduleLinkStatus: "active" as const, scheduleTokenHash },
		token
	});
}

export type RefreshPackageScheduleTokenResult = Awaited<
	ReturnType<typeof refreshPackageScheduleTokenHandler>
>;

export const markPackageScheduleEmailAttempt = internalMutation({
	args: {
		multiBookingId: v.id("multiBookingPackages"),
		status: v.union(v.literal("sent"), v.literal("failed"))
	},
	handler: async (ctx, args) => {
		const multiBooking = await ctx.db.get(args.multiBookingId);

		if (!multiBooking) {
			return err({ reason: "PACKAGE_NOT_FOUND" });
		}

		try {
			await ctx.db.patch(args.multiBookingId, {
				status: args.status === "sent" ? "paid" : "schedule_email_failed"
			});
		} catch {
			return err({ reason: "PACKAGE_SCHEDULE_EMAIL_STATUS_UPDATE_FAILED" });
		}

		return ok({ updated: true });
	}
});

export const savePackageInstagramHandle = mutation({
	args: { multiBookingId: v.id("multiBookingPackages"), instagramHandle: v.string() },
	handler: savePackageInstagramHandleHandler
});

type SavePackageInstagramHandleArgs = {
	multiBookingId: Id<"multiBookingPackages">;
	instagramHandle: string;
};

async function savePackageInstagramHandleHandler(
	ctx: MutationCtx,
	args: SavePackageInstagramHandleArgs
) {
	const multiBooking = await ctx.db.get(args.multiBookingId);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	if (multiBooking.status !== "pending_payment" && multiBooking.status !== "paid") {
		return err({ reason: "PACKAGE_NOT_ACTIVE" });
	}

	try {
		await ctx.db.patch(multiBooking._id, { instagramHandle: args.instagramHandle });
	} catch {
		return err({ reason: "PACKAGE_INSTAGRAM_HANDLE_SAVE_FAILED" });
	}

	return ok({ saved: true });
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
