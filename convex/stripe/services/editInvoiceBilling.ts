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
import { ResultAsync, type Result } from "neverthrow";
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
	type BillingRecord,
	type EditInvoiceContext
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
	return listCheckoutPaymentPage(ctx, args.table, args.cursor).map((page) => ({
		...page,
		page: selectMissingCheckoutPayments(page.page)
	}));
}

export function saveOriginalPaidAmount(
	ctx: MutationCtx,
	args: { target: EditInvoiceTarget; amount: number; stripeSessionId: string }
) {
	return loadEditInvoiceRecord(ctx, args.target).andThen((record) =>
		cacheOriginalPaymentIfMissing(ctx, record, args)
	);
}

type BillingSessions = BillingRecord & { bookings: Doc<"bookings">[] };

function loadBillingInvoices(ctx: QueryCtx, billing: BillingSessions) {
	return ResultAsync.combine([
		loadTargetInvoices(ctx, billing.target),
		listStripeInvoicesForBookings(ctx, billingBookingIds(billing))
	]).map(([invoices, sessionInvoices]) => ({
		...billing,
		invoices: [...invoices, ...sessionInvoices]
	}));
}

function quoteDraftChanges(
	billing: BillingSessions & { invoices: Doc<"stripeInvoices">[] },
	draft: EditInvoiceDraft | undefined
): Result<EditInvoiceContext, { reason: string }> {
	const packageDraft = draft?.kind === "package" ? draft : null;
	const regularDraft = draft?.kind === "package" ? undefined : draft;
	const regularChanges = quoteRegularDraftChanges(billing, regularDraft);

	return requirePackageBillingRecord(billing.record, packageDraft)
		.andThen((record) => requirePackageDraftMatchesRecord(record, packageDraft).map(() => record))
		.andThen((record) =>
			parseOptionalPackageDraft(packageDraft).map((parsed) => ({ record, parsed }))
		)
		.andThen(({ record, parsed }) =>
			validateOptionalPackageDraft(packageDraft, parsed, billing.bookings.length).map(
				(validated) => ({ record, validated })
			)
		)
		.andThen(({ validated }) =>
			buildOptionalPackageEditInvoiceDraft(
				billing.record,
				billing.bookings,
				packageDraft,
				validated
			)
		)
		.andThen((packageChanges) =>
			regularChanges.map((regular) =>
				billingInvoiceContext(billing, packageDraft === null ? regular : packageChanges)
			)
		);
}

export function loadEditInvoiceContext(
	ctx: QueryCtx,
	args: { target: EditInvoiceTarget; draft?: EditInvoiceDraft }
): ResultAsync<EditInvoiceContext, { reason: string }> {
	return loadEditInvoiceRecord(ctx, args.target)
		.andThen((record) =>
			requireLoadedBillingRecord(record === null ? null : { target: args.target, record })
		)
		.andThen((billing) => loadRedirectedBillingRecord(ctx, billing))
		.andThen(requireLoadedBillingRecord)
		.andThen((billing) => loadBillingSessions(ctx, billing))
		.andThen((billing) => loadBillingInvoices(ctx, billing))
		.andThen((billing) => quoteDraftChanges(billing, args.draft));
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
