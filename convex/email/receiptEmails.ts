"use node";

import { v } from "convex/values";
import { ok, safeTry } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import { action } from "#convex/_generated/server";
import {
	loadConfirmedSessionForReceiptResend,
	recordBookingReceiptResendOutcome,
	sendBookingReceiptEmailToCustomer,
	writeStandaloneBookingReceiptNumber
} from "#convex/booking/services/receiptResend";

export const resendBookingReceipt = action({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		safeTry(async function* () {
			const session = yield* loadConfirmedSessionForReceiptResend(ctx, args);
			const numberedSession = yield* writeStandaloneBookingReceiptNumber(ctx, session);
			const outcome = yield* sendBookingReceiptEmailToCustomer(ctx, numberedSession);
			const result = yield* recordBookingReceiptResendOutcome(ctx, outcome);

			return ok(result);
		}).match(tupleOk, tupleErr)
});
