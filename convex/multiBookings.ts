"use node";

import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, type ActionCtx } from "./_generated/server";
import { calculateMultiBookingAmounts } from "../src/sites/studio/features/booking-form/lib/booking-pricing";
import { multiBookingFormSchema } from "../src/sites/studio/features/booking-form/lib/booking-form-model";
import { err, ok, type Result } from "../src/lib/result";
import { sendMultiBookingInvoiceEmail } from "./lib/email";
import { emailDomainCanReceiveMail, getBookingSubmitRateLimitKey } from "./lib/bookingSubmission";
import type { MultiBookingInvoiceSource } from "./lib/bookingInvoiceArtifacts";

type PendingMultiBookingCreationResult = Result<
	{ multiBooking: MultiBookingInvoiceSource },
	{ reason: "BOOKING_RATE_LIMITED"; retryAfter?: number } | { reason: "PACKAGE_CREATE_FAILED" }
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

	const isValidEmailDomain = await emailDomainCanReceiveMail(multiBooking.email);

	if (!isValidEmailDomain) {
		return err({ reason: "BOOKING_EMAIL_DOMAIN_INVALID" });
	}

	const amounts = calculateMultiBookingAmounts(multiBooking);
	const [pendingMultiBookingError, pendingMultiBooking]: PendingMultiBookingCreationResult =
		await ctx.runMutation(internal.bookings.createPendingMultiBooking, {
			submitRateLimitKey: getBookingSubmitRateLimitKey(multiBooking.email),
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
			currency: amounts.currency,
			singleSessionAmount: amounts.singleSessionAmount,
			packageSubtotalAmount: amounts.packageSubtotalAmount,
			discountPercent: amounts.discountPercent,
			discountAmount: amounts.discountAmount,
			totalDueAmount: amounts.totalDueAmount
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
