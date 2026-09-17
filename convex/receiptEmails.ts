"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "#convex/_generated/server";
import { resendBookingReceiptService } from "#convex/services/receiptEmails";

export const resendBookingReceipt = action({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		(await resendBookingReceiptService(ctx, args)).match(tupleOk, tupleErr)
});
