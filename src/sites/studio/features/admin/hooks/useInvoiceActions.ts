import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { exhaustiveCheck, tryCatch } from "#/lib/result";
import type { ParsedStripeInvoiceLineItem } from "#studio/features/admin/lib/stripe-invoice-line-items";
import {
	downloadSessionCustomInvoice,
	mapSessionCustomInvoicesToListItems
} from "#studio/features/admin/lib/legacy-custom-invoices";
import {
	type DownloadAdminBookingInvoiceResult,
	downloadAdminBookingInvoice
} from "#studio/features/admin/lib/download-admin-booking-invoice";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import { getStripeBillingInvoicesState } from "#studio/features/admin/lib/stripe-invoice-billing";

function showSendStripeInvoiceError(reason: string) {
	switch (reason) {
		case "NOT_AUTHENTICATED":
			toast.error("You are not signed in.");

			return;
		case "NOT_AUTHORIZED":
			toast.error("You do not have access to send Stripe invoices.");

			return;
		case "BOOKING_NOT_FOUND":
			toast.error("This session no longer exists.");

			return;
		case "STRIPE_CUSTOMER_NOT_FOUND":
			toast.error("This session has no Stripe customer ID.");

			return;
		case "INVALID_LINE_ITEMS":
			toast.error("Add at least one line item with a description and amount greater than zero.");

			return;
		case "STRIPE_INVOICE_FAILED":
			toast.error("Unable to send Stripe invoice.");

			return;
		case "UNEXPECTED_ERROR":
			toast.error("Something went wrong while sending the Stripe invoice.");

			return;
		default:
			toast.error("Unable to send Stripe invoice.");
	}
}

export function useInvoiceActions(session: SessionRecord) {
	const sendBookingStripeInvoice = useAction(api.stripeInvoicing.sendBookingStripeInvoice);
	const bookingSettings = useQuery(api.bookingSettings.get, {});
	const [isLegacyCustomInvoicesDialogOpen, setIsLegacyCustomInvoicesDialogOpen] = useState(false);

	const customInvoicesResult = useQuery(
		api.customInvoices.listCustomInvoicesForBooking,
		isLegacyCustomInvoicesDialogOpen ? { bookingId: session._id } : "skip"
	);

	const [isStripeInvoiceDialogOpen, setIsStripeInvoiceDialogOpen] = useState(false);
	const [isStripeBillingDialogOpen, setIsStripeBillingDialogOpen] = useState(false);

	const stripeInvoicesResult = useQuery(api.stripeInvoices.listStripeInvoicesForBooking, {
		bookingId: session._id
	});

	const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
	const [isSendingStripeInvoice, setIsSendingStripeInvoice] = useState(false);

	const [downloadingLegacyCustomInvoiceId, setDownloadingLegacyCustomInvoiceId] =
		useState<Id<"customInvoices"> | null>(null);

	async function handleDownloadInvoice() {
		setIsDownloadingInvoice(true);

		if (!bookingSettings) {
			setIsDownloadingInvoice(false);
			toast.error("Booking settings are still loading.");

			return;
		}

		const [error] = await tryCatch<DownloadAdminBookingInvoiceResult>(
			downloadAdminBookingInvoice({
				session,
				createdAt: session.pendingPaymentCreatedAt,
				leadTimeMinutes: bookingSettings.leadTimeMinutes
			})
		);

		setIsDownloadingInvoice(false);

		if (error !== null) {
			const reason = error.reason;

			switch (reason) {
				case "INVALID_INVOICE_INPUT":
					toast.error(error.message);

					return;
				case "UNEXPECTED_ERROR":
					toast.error("Unable to generate invoice.");

					return;
				default:
					exhaustiveCheck(reason);
			}
		}

		toast.success("Invoice download started.");
	}

	const customInvoices = customInvoicesResult?.[1];

	const legacyCustomInvoices =
		customInvoices === undefined || customInvoices === null
			? undefined
			: mapSessionCustomInvoicesToListItems(customInvoices, session);

	async function handleDownloadLegacyCustomInvoice(customInvoiceId: Id<"customInvoices">) {
		const customInvoice = customInvoicesResult?.[1]?.find(
			(invoice) => invoice._id === customInvoiceId
		);

		if (!customInvoice) {
			return;
		}

		if (!bookingSettings) {
			toast.error("Booking settings are still loading.");

			return;
		}

		setDownloadingLegacyCustomInvoiceId(customInvoice._id);

		const [error] = await tryCatch<DownloadAdminBookingInvoiceResult>(
			downloadSessionCustomInvoice({
				customInvoice,
				leadTimeMinutes: bookingSettings.leadTimeMinutes,
				session
			})
		);

		setDownloadingLegacyCustomInvoiceId(null);

		if (error !== null) {
			if (error.reason === "INVALID_INVOICE_INPUT") {
				toast.error(error.message);

				return;
			}

			toast.error("Unable to generate custom invoice.");

			return;
		}

		toast.success("Custom invoice download started.");
	}

	async function handleSendStripeInvoice(input: {
		lineItems: ParsedStripeInvoiceLineItem[];
		requestId: string;
	}) {
		setIsSendingStripeInvoice(true);

		const [error] = await tryCatch(
			sendBookingStripeInvoice({
				bookingId: session._id,
				lineItems: input.lineItems,
				requestId: input.requestId
			})
		);

		setIsSendingStripeInvoice(false);

		if (error !== null) {
			showSendStripeInvoiceError(error.reason);

			return;
		}

		setIsStripeInvoiceDialogOpen(false);
		toast.success("Stripe invoice sent.");
	}

	const { hasStripeBillingInvoices, stripeBillingInvoices } = getStripeBillingInvoicesState(
		stripeInvoicesResult,
		isStripeBillingDialogOpen
	);

	return {
		downloadingLegacyCustomInvoiceId,
		handleDownloadInvoice,
		handleDownloadLegacyCustomInvoice,
		handleSendStripeInvoice,
		hasStripeBillingInvoices,
		hasStripeCustomer: Boolean(session.stripeCustomerId),
		isDownloadingInvoice,
		isLegacyCustomInvoicesDialogOpen,
		isSendingStripeInvoice,
		isStripeBillingDialogOpen,
		isStripeInvoiceDialogOpen,
		legacyCustomInvoices,
		setIsLegacyCustomInvoicesDialogOpen,
		setIsStripeBillingDialogOpen,
		setIsStripeInvoiceDialogOpen,
		stripeBillingInvoices
	};
}
