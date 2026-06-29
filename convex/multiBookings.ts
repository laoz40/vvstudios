"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import { calculateMultiBookingAmounts } from "../src/sites/studio/features/booking-form/lib/booking-pricing";
import { multiBookingFormSchema } from "../src/sites/studio/features/booking-form/lib/booking-form-model";
import { createMultiBookingInvoiceLineItemSnapshot } from "../src/sites/studio/features/booking-invoice/lib/build-booking-invoice-data";
import { err, ok, type Result } from "../src/lib/result";
import { sendMultiBookingInvoiceEmail } from "./lib/email";
import { emailDomainCanReceiveMail, getBookingSubmitRateLimitKey } from "./lib/bookingSubmission";
import type { MultiBookingInvoiceSource } from "./lib/bookingInvoiceArtifacts";
import { getAdminIdentity } from "./lib/auth";

type PendingMultiBookingCreationResult = Result<
	{ multiBooking: MultiBookingInvoiceSource },
	{ reason: "PACKAGE_CREATE_FAILED" }
>;

export const createMultiBookingRequest = action({
	args: {
		name: v.string(),
		phone: v.string(),
		accountName: v.string(),
		abn: v.optional(v.string()),
		email: v.string(),
		duration: v.string(),
		service: v.string(),
		addons: v.array(v.string()),
		essentialEditQuantity: v.optional(v.string()),
		clipsPackageQuantity: v.optional(v.string()),
		notes: v.optional(v.string()),
		packageSize: v.union(v.literal(4), v.literal(8), v.literal(12))
	},
	handler: (ctx, args) => createMultiBookingRequestHandler(ctx, args)
});

async function createMultiBookingRequestHandler(
	ctx: ActionCtx,
	args: {
		name: string;
		phone: string;
		accountName: string;
		abn?: string;
		email: string;
		duration: string;
		service: string;
		addons: string[];
		essentialEditQuantity?: string;
		clipsPackageQuantity?: string;
		notes?: string;
		packageSize: 4 | 8 | 12;
	}
): Promise<
	Result<
		{ multiBookingId: Id<"multiBookingPackages">; invoiceEmailStatus: "sent" | "failed" },
		| { reason: "BOOKING_EMAIL_DOMAIN_INVALID" }
		| { reason: "BOOKING_INVALID_INPUT" }
		| { reason: "BOOKING_RATE_LIMITED"; retryAfter?: number }
		| { reason: "PACKAGE_CREATE_FAILED" }
	>
> {
	const parsedMultiBooking = multiBookingFormSchema.safeParse(args);

	if (!parsedMultiBooking.success) {
		return err({ reason: "BOOKING_INVALID_INPUT" });
	}

	const multiBooking = parsedMultiBooking.data;

	const [rateLimitError] = await ctx.runMutation(
		internal.bookings.checkBookingSubmitRateLimitInternal,
		{ submitRateLimitKey: getBookingSubmitRateLimitKey(multiBooking.email) }
	);

	if (rateLimitError !== null) {
		return err(rateLimitError);
	}

	const isValidEmailDomain = await emailDomainCanReceiveMail(multiBooking.email);

	if (!isValidEmailDomain) {
		return err({ reason: "BOOKING_EMAIL_DOMAIN_INVALID" });
	}

	const amounts = calculateMultiBookingAmounts(multiBooking);
	const invoiceLineItems = createMultiBookingInvoiceLineItemSnapshot({
		addons: multiBooking.addons,
		clipsPackageQuantity: multiBooking.clipsPackageQuantity || undefined,
		discountAmount: amounts.discountAmount,
		discountPercent: amounts.discountPercent,
		duration: multiBooking.duration,
		essentialEditQuantity: multiBooking.essentialEditQuantity || undefined,
		packageSize: multiBooking.packageSize,
		service: multiBooking.service
	});
	const [pendingMultiBookingError, pendingMultiBooking]: PendingMultiBookingCreationResult =
		await ctx.runMutation(internal.bookings.createPendingMultiBooking, {
			name: multiBooking.name,
			phone: multiBooking.phone,
			accountName: multiBooking.accountName,
			abn: multiBooking.abn,
			email: multiBooking.email,
			duration: multiBooking.duration,
			service: multiBooking.service,
			addons: multiBooking.addons,
			essentialEditQuantity: multiBooking.essentialEditQuantity || undefined,
			clipsPackageQuantity: multiBooking.clipsPackageQuantity || undefined,
			notes: multiBooking.notes || undefined,
			packageSize: multiBooking.packageSize,
			singleSessionAmount: amounts.singleSessionAmount,
			packageSubtotalAmount: amounts.packageSubtotalAmount,
			discountPercent: amounts.discountPercent,
			discountAmount: amounts.discountAmount,
			totalDueAmount: amounts.totalDueAmount,
			invoiceLineItems
		});

	if (pendingMultiBookingError !== null) {
		return err(pendingMultiBookingError);
	}

	const createdMultiBooking = pendingMultiBooking.multiBooking;

	const [invoiceEmailError, invoiceEmail] = await sendMultiBookingInvoiceEmail(createdMultiBooking);

	if (invoiceEmailError !== null) {
		await ctx.runMutation(internal.bookings.markMultiBookingInvoiceEmailAttempt, {
			multiBookingId: createdMultiBooking._id,
			status: "failed",
			failureCode: invoiceEmailError.reason
		});

		return ok({ multiBookingId: createdMultiBooking._id, invoiceEmailStatus: "failed" });
	}

	await ctx.runMutation(internal.bookings.markMultiBookingInvoiceEmailAttempt, {
		multiBookingId: createdMultiBooking._id,
		invoiceNumber: invoiceEmail.invoiceNumber,
		status: "sent"
	});

	return ok({ multiBookingId: createdMultiBooking._id, invoiceEmailStatus: "sent" });
}

export type CreateMultiBookingRequestResult = Awaited<
	ReturnType<typeof createMultiBookingRequestHandler>
>;

export const resendMultiBookingInvoiceEmail = action({
	args: { multiBookingId: v.id("multiBookingPackages") },
	handler: (ctx, args) => resendMultiBookingInvoiceEmailHandler(ctx, args)
});

async function resendMultiBookingInvoiceEmailHandler(
	ctx: ActionCtx,
	args: { multiBookingId: Id<"multiBookingPackages"> }
) {
	const [authError] = await getAdminIdentity(ctx);

	if (authError !== null) {
		return err(authError);
	}

	const multiBooking: Doc<"multiBookingPackages"> | null = await ctx.runQuery(
		internal.bookings.getMultiBookingPackageByIdInternal,
		{ multiBookingId: args.multiBookingId }
	);

	if (!multiBooking) {
		return err({ reason: "PACKAGE_NOT_FOUND" });
	}

	if (multiBooking.status !== "pending_payment" && multiBooking.status !== "invoice_email_failed") {
		return err({ reason: "PACKAGE_NOT_UNPAID" });
	}

	const [invoiceEmailError, invoiceEmail] = await sendMultiBookingInvoiceEmail(multiBooking);

	if (invoiceEmailError !== null) {
		await ctx.runMutation(internal.bookings.markMultiBookingInvoiceEmailAttempt, {
			multiBookingId: multiBooking._id,
			status: "failed",
			failureCode: invoiceEmailError.reason
		});

		return err({ reason: "PACKAGE_INVOICE_EMAIL_FAILED" });
	}

	await ctx.runMutation(internal.bookings.markMultiBookingInvoiceEmailAttempt, {
		multiBookingId: multiBooking._id,
		invoiceNumber: invoiceEmail.invoiceNumber,
		status: "sent"
	});

	return ok({ sent: true });
}

export type ResendMultiBookingInvoiceEmailResult = Awaited<
	ReturnType<typeof resendMultiBookingInvoiceEmailHandler>
>;
