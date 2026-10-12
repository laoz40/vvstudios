"use node";

import { type ResultAsync, ok, safeTry } from "neverthrow";

import type { Id } from "#convex/_generated/dataModel";
import type { ActionCtx } from "#convex/_generated/server";
import {
	requirePermissionActions,
	type PermissionActionError
} from "#convex/shared/services/requirePermissionActions";
import type { StripeInvoiceBillingUrls } from "#convex/stripe/lib/invoiceBillingUrls";
import type { EditInvoiceTarget } from "#convex/stripe/lib/editInvoiceDb";
import { getPackageForAction } from "#convex/packages/services/lookup";
import { fromConvexTuple } from "#convex/shared/lib/result";
import { getSessionFromQuery } from "#convex/sessions/services/lookup";
import {
	validateStripeInvoiceLineItems,
	createAndSendBookingStripeInvoice,
	createAndSendPackageStripeInvoice,
	createAndSendOptionalEditInvoice,
	recordBookingStripeInvoiceFromAction,
	recordPackageStripeInvoiceFromAction,
	recordOptionalEditInvoiceFromAction,
	requireStripeInvoiceCustomerId,
	type StripeInvoiceLineItem,
	type StripeInvoiceSenderIdentity
} from "#convex/stripe/lib/invoice";
import { getStripeInvoiceBillingUrls as fetchStripeInvoiceBillingUrls } from "#convex/stripe/lib/invoiceBillingUrls";
import { getStripeClient } from "#convex/stripe/lib/client";

export function requireSendReceiptEmailsAndValidateLineItems(
	ctx: ActionCtx,
	lineItems: StripeInvoiceLineItem[]
): ResultAsync<
	{ identity: { email?: string }; lineItems: StripeInvoiceLineItem[] },
	{ reason: string }
> {
	return safeTry(async function* () {
		const identity = yield* requirePermissionActions(ctx, "send:receipt-emails");
		const validatedLineItems = yield* validateStripeInvoiceLineItems(lineItems);

		return ok({ identity, lineItems: validatedLineItems });
	});
}

export function loadBookingStripeCustomerId(
	ctx: ActionCtx,
	bookingId: Id<"bookings">
): ResultAsync<string, { reason: string }> {
	return safeTry(async function* () {
		const session = yield* getSessionFromQuery(ctx, bookingId);
		const stripeCustomerId = yield* requireStripeInvoiceCustomerId(session.stripeCustomerId);

		return ok(stripeCustomerId);
	});
}

export function loadPackageStripeCustomerId(
	ctx: ActionCtx,
	packageId: Id<"packages">
): ResultAsync<string, { reason: string }> {
	return safeTry(async function* () {
		const packageRecord = yield* getPackageForAction(ctx, packageId);
		const stripeCustomerId = yield* requireStripeInvoiceCustomerId(packageRecord.stripeCustomerId);

		return ok(stripeCustomerId);
	});
}

export function loadStripeInvoiceBillingUrlsForStaff(
	ctx: ActionCtx,
	stripeInvoiceId: string
): ResultAsync<
	StripeInvoiceBillingUrls,
	PermissionActionError | { reason: "STRIPE_INVOICE_LOOKUP_FAILED" }
> {
	return safeTry(async function* () {
		yield* requirePermissionActions(ctx, "view:sensitive-booking-data");
		const billingUrls = yield* fetchStripeInvoiceBillingUrls(getStripeClient(), stripeInvoiceId);

		return ok(billingUrls);
	});
}

function recordBookingStripeInvoiceAfterSend(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	{ stripeInvoiceId }: { stripeInvoiceId: string }
): ResultAsync<{ stripeInvoiceId: string }, { reason: string }> {
	return safeTry(async function* () {
		yield* fromConvexTuple(
			recordBookingStripeInvoiceFromAction(ctx, args, identity, stripeInvoiceId)
		);

		return ok({ stripeInvoiceId });
	});
}

function recordPackageStripeInvoiceAfterSend(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	{ stripeInvoiceId }: { stripeInvoiceId: string }
): ResultAsync<{ stripeInvoiceId: string }, { reason: string }> {
	return safeTry(async function* () {
		yield* fromConvexTuple(
			recordPackageStripeInvoiceFromAction(ctx, args, identity, stripeInvoiceId)
		);

		return ok({ stripeInvoiceId });
	});
}

export function createAndRecordBookingStripeInvoice(
	ctx: ActionCtx,
	args: { bookingId: Id<"bookings">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	stripeCustomerId: string
): ResultAsync<{ stripeInvoiceId: string }, { reason: string }> {
	return safeTry(async function* () {
		const invoice = yield* createAndSendBookingStripeInvoice(
			getStripeClient(),
			args,
			stripeCustomerId
		);

		const recordedInvoice = yield* recordBookingStripeInvoiceAfterSend(
			ctx,
			args,
			identity,
			invoice
		);

		return ok(recordedInvoice);
	});
}

export function createAndRecordPackageStripeInvoice(
	ctx: ActionCtx,
	args: { packageId: Id<"packages">; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	stripeCustomerId: string
): ResultAsync<{ stripeInvoiceId: string }, { reason: string }> {
	return safeTry(async function* () {
		const invoice = yield* createAndSendPackageStripeInvoice(
			getStripeClient(),
			args,
			stripeCustomerId
		);

		const recordedInvoice = yield* recordPackageStripeInvoiceAfterSend(
			ctx,
			args,
			identity,
			invoice
		);

		return ok(recordedInvoice);
	});
}

export function createAndRecordOptionalEditInvoice(
	ctx: ActionCtx,
	args: { target: EditInvoiceTarget | null; lineItems: StripeInvoiceLineItem[]; requestId: string },
	identity: StripeInvoiceSenderIdentity,
	stripeCustomerId: string
): ResultAsync<{ stripeInvoiceId: string } | null, { reason: string }> {
	return safeTry(async function* () {
		const invoice = yield* createAndSendOptionalEditInvoice(getStripeClient(), {
			...args,
			stripeCustomerId
		});

		yield* recordOptionalEditInvoiceFromAction(ctx, {
			...args,
			createdBy: identity.email,
			stripeInvoiceId: invoice?.stripeInvoiceId ?? null
		});

		return ok(invoice);
	});
}
