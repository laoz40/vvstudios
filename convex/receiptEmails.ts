"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "#convex/_generated/server";
import {
	resendBookingReceiptService,
	resendPackageReceiptService
} from "#convex/services/receiptEmails";

export const resendBookingReceipt = action({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		(await resendBookingReceiptService(ctx, args)).match(tupleOk, tupleErr)
});

export const resendPackageReceipt = action({
	args: { packageId: v.id("packages") },
	handler: async (ctx, args) =>
		(await resendPackageReceiptService(ctx, args)).match(tupleOk, tupleErr)
});
