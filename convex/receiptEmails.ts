"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "#convex/_generated/server";
import {
	loadConfirmedSessionForReceiptResend,
	recordBookingReceiptResendOutcome,
	sendBookingReceiptEmailToCustomer,
	writeStandaloneBookingReceiptNumber
} from "#convex/services/booking/bookingReceiptResendWorkflow";

export const resendBookingReceipt = action({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		await loadConfirmedSessionForReceiptResend(ctx, args)
			.andThen((session) => writeStandaloneBookingReceiptNumber(ctx, session))
			.andThen((session) => sendBookingReceiptEmailToCustomer(ctx, session))
			.andThen((result) => recordBookingReceiptResendOutcome(ctx, result))
			.match(tupleOk, tupleErr)
});
