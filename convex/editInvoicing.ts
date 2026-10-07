"use node";

import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { action, internalAction } from "#convex/_generated/server";
import { editInvoiceTargetValidator } from "#convex/editInvoices";
import { editInvoiceDraftValidator } from "#convex/services/stripe/editInvoiceValidators";
import {
	loadEditInvoicePreviewFromAction,
	backfillCheckoutPayments,
	saveNonbillableChanges,
	requireEditInvoicePermissions,
	loadConfirmedEditContext,
	finishConfirmedEdit
} from "#convex/services/stripe/editInvoiceSend";

export const backfillOriginalPayments = internalAction({
	args: {
		table: v.union(v.literal("bookings"), v.literal("packages")),
		cursor: v.union(v.string(), v.null())
	},
	handler: (ctx, args) => backfillCheckoutPayments(ctx, args).match(tupleOk, tupleErr)
});

export const getQuote = action({
	args: { target: editInvoiceTargetValidator, draft: v.optional(editInvoiceDraftValidator) },
	handler: (ctx, args) => loadEditInvoicePreviewFromAction(ctx, args).match(tupleOk, tupleErr)
});

export const saveNonbillableDraft = action({
	args: { draft: editInvoiceDraftValidator },
	handler: (ctx, args) => saveNonbillableChanges(ctx, args.draft).match(tupleOk, tupleErr)
});

export const saveChangesAndSendInvoice = action({
	args: {
		draft: editInvoiceDraftValidator,
		requestId: v.string(),
		total: v.number(),
		amount: v.number(),
		revision: v.string()
	},
	handler: (ctx, args) =>
		requireEditInvoicePermissions(ctx)
			.andThen((identity) => loadConfirmedEditContext(ctx, args, identity))
			.andThen(({ identity, context }) => finishConfirmedEdit(ctx, args, identity, context))
			.match(tupleOk, tupleErr)
});
