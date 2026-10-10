import { err, ok, Result } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import { getBookingTotal } from "#/domain/booking/pricing";
import { bookingSchema } from "#studio/features/booking-form/lib/booking-form-model";
import { buildAdminSessionUpdatePatch } from "#convex/sessions/lib/sessionAdminEdit";
import {
	type ParsedPackageRequest,
	buildPackageUpdatePatch,
	parsePackageUpdate,
	validatePackageUpdate
} from "#convex/packages/lib/packageUpdates";
import { calculatePaidAmount } from "#convex/stripe/lib/stripeInvoices";
import type { EditInvoiceTarget } from "#convex/stripe/lib/editInvoiceDb";
import type { EditInvoiceDraft } from "#convex/stripe/services/editInvoiceValidators";
import {
	buildEditInvoiceAdditions,
	buildEditInvoiceLineItems
} from "#convex/stripe/lib/editInvoiceLineItems";
import type { StripeInvoiceLineItem } from "#convex/stripe/lib/stripeInvoice";

export type EditInvoiceQuote = {
	target: EditInvoiceTarget;
	currentTotal: number;
	total: number;
	amount: number;
	lineItems: StripeInvoiceLineItem[];
	paidAmount: number | null;
	description: string;
	customerEmail: string;
	revision: string;
	requestId: string;
};

export function getDraftTarget(draft: EditInvoiceDraft): EditInvoiceTarget {
	return draft.kind === "booking"
		? { kind: "booking", bookingId: draft.values.bookingId }
		: { kind: "package", packageId: draft.values.packageId };
}

export type BillingRecord = {
	target: EditInvoiceTarget;
	record: Doc<"bookings"> | Doc<"packages">;
};

export type EditInvoiceContext = BillingRecord & {
	invoices: Doc<"stripeInvoices">[];
	currentTotal: number;
	total: number;
	additions: StripeInvoiceLineItem[];
	revision: string;
	alreadySaved: boolean;
};

export function buildEditInvoiceContext(
	billing: BillingRecord,
	bookings: Doc<"bookings">[],
	next: {
		record: BillingRecord["record"];
		bookings: Doc<"bookings">[];
		additions: StripeInvoiceLineItem[];
	},
	invoices: Doc<"stripeInvoices">[]
): EditInvoiceContext {
	const revision = JSON.stringify([billing.record, bookings]);
	const nextRevision = JSON.stringify([next.record, next.bookings]);

	return {
		...billing,
		invoices,
		currentTotal: calculateBillingTotal(billing.record, bookings),
		total: calculateBillingTotal(next.record, next.bookings),
		additions: next.additions,
		revision,
		alreadySaved: revision === nextRevision
	};
}

export function needsCheckoutPayment(record: BillingRecord["record"]) {
	if (record.originalPaidAmount !== undefined) return false;

	if (record.stripeSessionId === undefined) return false;

	if ("packageSize" in record) return record.paidAt !== undefined;

	return record.paymentCompletedAt !== undefined;
}

function applySessionDraft(
	record: Doc<"bookings">,
	draft: Extract<EditInvoiceDraft, { kind: "booking" }>,
	timeZone: string
) {
	const parsed = bookingSchema.safeParse({
		...draft.values,
		abn: draft.values.abn ?? "",
		notes: draft.values.notes ?? "",
		bookingMode: "single",
		packageSize: ""
	});

	if (!parsed.success) return err({ reason: "BOOKING_INVALID_INPUT" as const });

	return buildAdminSessionUpdatePatch({ session: record, values: draft.values, timeZone }).map(
		(patch) => ({ ...record, ...patch })
	);
}

type AppliedDraft = {
	record: BillingRecord["record"];
	bookings: Doc<"bookings">[];
	additions: StripeInvoiceLineItem[];
};

type SessionDraft = Extract<EditInvoiceDraft, { kind: "booking" }>;

type PackageDraft = Extract<EditInvoiceDraft, { kind: "package" }>;

function applyPackageDraft(
	record: Doc<"packages">,
	bookings: Doc<"bookings">[],
	draft: PackageDraft
) {
	if (record._id !== draft.values.packageId) return err({ reason: "BILLING_RECORD_NOT_FOUND" });

	const parsedResult: Result<ParsedPackageRequest, { reason: "INVALID_BOOKING_DATA" }> =
		parsePackageUpdate(draft.values);

	return parsedResult
		.andThen((parsed) => validatePackageUpdate(draft.values, parsed, bookings.length))
		.map((parsed) => ({
			record: { ...record, ...buildPackageUpdatePatch(draft.values, parsed) },
			bookings,
			additions: buildEditInvoiceAdditions({
				current: record,
				next: parsed,
				currentSessionCount: record.packageSize,
				nextSessionCount: parsed.packageSize,
				excludeRemote: false
			})
		}));
}

function applyStandaloneSessionDraft(
	record: Doc<"bookings">,
	bookings: Doc<"bookings">[],
	draft: SessionDraft,
	timeZone: string
) {
	return applySessionDraft(record, draft, timeZone).map((next) => ({
		record: next,
		bookings,
		additions: buildEditInvoiceAdditions({
			current: record,
			next,
			currentSessionCount: 1,
			nextSessionCount: 1,
			excludeRemote: false
		})
	}));
}

function applyLinkedSessionDraft(
	record: Doc<"packages">,
	bookings: Doc<"bookings">[],
	draft: SessionDraft,
	timeZone: string
) {
	const bookingId = draft.values.bookingId;
	const booking = bookings.find((session) => session._id === bookingId);

	if (!booking) return err({ reason: "BILLING_RECORD_NOT_FOUND" });

	return applySessionDraft(booking, draft, timeZone).map((nextBooking) => {
		const nextBookings = bookings.map((session) =>
			session._id === bookingId ? nextBooking : session
		);

		return {
			record,
			bookings: nextBookings,
			additions: buildLinkedSessionAdditions(bookings, nextBookings, bookingId)
		};
	});
}

export function applyEditInvoiceDraft(
	record: BillingRecord["record"],
	bookings: Doc<"bookings">[],
	draft: EditInvoiceDraft | undefined,
	timeZone: string
): Result<AppliedDraft, { reason: string }> {
	if (!draft) return ok({ record, bookings, additions: [] });

	if (draft.kind === "package") {
		if (!("packageSize" in record)) return err({ reason: "BILLING_RECORD_NOT_FOUND" });

		return applyPackageDraft(record, bookings, draft);
	}

	if ("packageSize" in record) return applyLinkedSessionDraft(record, bookings, draft, timeZone);

	return applyStandaloneSessionDraft(record, bookings, draft, timeZone);
}

function buildLinkedSessionAdditions(
	bookings: Doc<"bookings">[],
	nextBookings: Doc<"bookings">[],
	bookingId: Doc<"bookings">["_id"]
) {
	const current = bookings.find((booking) => booking._id === bookingId);
	const next = nextBookings.find((booking) => booking._id === bookingId);

	if (!current || !next) return [];

	return buildEditInvoiceAdditions({
		current,
		next,
		currentSessionCount: 1,
		nextSessionCount: 1,
		excludeRemote: true
	});
}

function calculateBillingTotal(
	record: Doc<"bookings"> | Doc<"packages">,
	bookings: Doc<"bookings">[]
) {
	if (!("packageSize" in record)) return getBookingTotal(record);

	// Remote Podcast is billed by the existing end-of-package adjustment.
	const sessionExtras = bookings.reduce((total, booking) => {
		const addons = booking.addons.filter((addon) => addon !== "Remote Podcast");
		const sessionTotal = getBookingTotal({ ...booking, addons });
		const extra = Math.max(sessionTotal - record.singleSessionAmount, 0);

		return total + extra;
	}, 0);

	return record.totalDueAmount + sessionExtras;
}

export function buildEditInvoiceQuote(
	context: EditInvoiceContext,
	checkoutPaid: number | null,
	requestId: string
): EditInvoiceQuote {
	const { record, invoices } = context;
	const remaining = "packageSize" in record ? 0 : (record.remainingBalanceAmount ?? 0);

	const invoiced = invoices
		.filter((invoice) => invoice.kind !== "package_adjustment")
		.reduce((total, invoice) => total + invoice.totalAmount, 0);

	const remainingPaid = !("packageSize" in record) && record.paidRemainingBalance ? remaining : 0;

	const previouslyBilled = (checkoutPaid ?? 0) + remaining + invoiced;
	const coveredAmount = Math.max(context.currentTotal, previouslyBilled);
	const increase = Math.max(context.total - coveredAmount, 0);
	const amount = Math.round(increase * 100) / 100;

	const description = "packageSize" in record ? "Package price increase" : "Session price increase";

	return {
		target: context.target,
		currentTotal: context.currentTotal,
		total: context.total,
		amount,
		lineItems: buildEditInvoiceLineItems(context.additions, amount, description),
		paidAmount: calculatePaidAmount({
			originalPaidAmount: checkoutPaid,
			invoices,
			paidRemainingBalanceAmount: remainingPaid
		}),
		description,
		customerEmail: record.email,
		revision: context.revision,
		requestId
	};
}

export function getInvoiceTimingDraft(
	draft: EditInvoiceDraft | undefined,
	quote: EditInvoiceQuote
) {
	if (!draft || quote.amount <= 0) return null;

	if (draft.kind === "package") return null;

	return draft;
}
