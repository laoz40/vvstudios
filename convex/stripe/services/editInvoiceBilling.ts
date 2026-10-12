import {
	billingBookingIds,
	selectMissingCheckoutPayments,
	billingInvoiceContext,
	loadRedirectedBillingRecord,
	requirePackageBillingRecord,
	requireLoadedBillingRecord,
	parseOptionalPackageDraft,
	validateOptionalPackageDraft,
	type BillingWithInvoices
} from "#convex/stripe/lib/editInvoiceBillingSteps";
import { ResultAsync, ok, safeTry } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { QueryCtx, MutationCtx } from "#convex/_generated/server";
import { env } from "#convex/env";
import { listStripeInvoicesForBookings } from "#convex/stripe/lib/invoices";
import {
	loadEditInvoiceRecord,
	listCheckoutPaymentPage,
	cacheOriginalPaymentIfMissing,
	type EditInvoiceTarget
} from "#convex/stripe/lib/editInvoiceDb";
import {
	applyEditInvoiceDraft,
	buildOptionalPackageEditInvoiceDraft,
	requirePackageDraftMatchesRecord,
	type BillingRecord
} from "#convex/stripe/lib/editInvoiceBilling";
import type { EditInvoiceDraft } from "#convex/stripe/editInvoiceValidators";
import {
	loadBillingSessions,
	loadTargetInvoices
} from "#convex/stripe/lib/editInvoiceBillingSteps";

export function loadMissingCheckoutPayments(
	ctx: QueryCtx,
	args: { table: "bookings" | "packages"; cursor: string | null }
) {
	return safeTry(async function* () {
		const paymentPage = yield* listCheckoutPaymentPage(ctx, args.table, args.cursor);

		return ok({ ...paymentPage, page: selectMissingCheckoutPayments(paymentPage.page) });
	});
}

export function saveOriginalPaidAmount(
	ctx: MutationCtx,
	args: { target: EditInvoiceTarget; amount: number; stripeSessionId: string }
) {
	return safeTry(async function* () {
		const record = yield* loadEditInvoiceRecord(ctx, args.target);
		const updated = yield* cacheOriginalPaymentIfMissing(ctx, record, args);

		return ok(updated);
	});
}

type BillingSessions = BillingRecord & { bookings: Doc<"bookings">[] };

function loadBillingInvoices(ctx: QueryCtx, billing: BillingSessions) {
	return safeTry(async function* () {
		const [invoices, sessionInvoices] = yield* ResultAsync.combine([
			loadTargetInvoices(ctx, billing.target),
			listStripeInvoicesForBookings(ctx, billingBookingIds(billing))
		]);

		return ok({ ...billing, invoices: [...invoices, ...sessionInvoices] });
	});
}

function quoteDraftChanges(
	billing: BillingSessions & { invoices: Doc<"stripeInvoices">[] },
	draft: EditInvoiceDraft | undefined
) {
	const packageDraft = draft?.kind === "package" ? draft : null;
	const regularDraft = draft?.kind === "package" ? undefined : draft;
	const regularChanges = quoteRegularDraftChanges(billing, regularDraft);

	return safeTry(function* () {
		const packageRecord = yield* requirePackageBillingRecord(billing.record, packageDraft);
		yield* requirePackageDraftMatchesRecord(packageRecord, packageDraft);
		const parsed = yield* parseOptionalPackageDraft(packageDraft);

		const validated = yield* validateOptionalPackageDraft(
			packageDraft,
			parsed,
			billing.bookings.length
		);

		const packageEditInvoice = yield* buildOptionalPackageEditInvoiceDraft(
			billing.record,
			billing.bookings,
			packageDraft,
			validated
		);

		const regular = yield* regularChanges;

		return ok(billingInvoiceContext(billing, packageDraft === null ? regular : packageEditInvoice));
	});
}

export function loadEditInvoiceContext(
	ctx: QueryCtx,
	args: { target: EditInvoiceTarget; draft?: EditInvoiceDraft }
) {
	return safeTry(async function* () {
		const record = yield* loadEditInvoiceRecord(ctx, args.target);

		const billingRecord = yield* requireLoadedBillingRecord(
			record === null ? null : { target: args.target, record }
		);

		const redirectedRecord = yield* loadRedirectedBillingRecord(ctx, billingRecord);
		const loadedBillingRecord = yield* requireLoadedBillingRecord(redirectedRecord);
		const billingSessions = yield* loadBillingSessions(ctx, loadedBillingRecord);
		const billing = yield* loadBillingInvoices(ctx, billingSessions);
		const invoiceContext = yield* quoteDraftChanges(billing, args.draft);

		return ok(invoiceContext);
	});
}

function quoteRegularDraftChanges(
	billing: BillingWithInvoices,
	draft: Exclude<EditInvoiceDraft, { kind: "package" }> | undefined
) {
	return applyEditInvoiceDraft(
		billing.record,
		billing.bookings,
		draft,
		env.GOOGLE_CALENDAR_TIMEZONE
	);
}
