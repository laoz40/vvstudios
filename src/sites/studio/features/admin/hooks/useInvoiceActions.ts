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
import { downloadBlob } from "#studio/features/booking-invoice/pdf/download-blob";

type EmailBookingInvoiceRequest = {
	bookingId: SessionRecord["_id"];
	customInvoiceId?: Id<"customInvoices">;
};

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
	const sendBookingInvoiceForBooking = useAction(api.googleCalendar.sendBookingInvoiceForBooking);
	const sendBookingStripeInvoice = useAction(api.stripeInvoicing.sendBookingStripeInvoice);
	const getAdminPackageInvoicePdf = useAction(api.invoices.getAdminPackageInvoicePdfById);
	const bookingSettings = useQuery(api.bookingSettings.get, {});
	const [isEmailInvoiceDialogOpen, setIsEmailInvoiceDialogOpen] = useState(false);
	const [isLegacyCustomInvoicesDialogOpen, setIsLegacyCustomInvoicesDialogOpen] = useState(false);

	const shouldLoadCustomInvoices = isEmailInvoiceDialogOpen || isLegacyCustomInvoicesDialogOpen;

	const customInvoicesResult = useQuery(
		api.customInvoices.listCustomInvoicesForBooking,
		shouldLoadCustomInvoices ? { bookingId: session._id } : "skip"
	);

	const [selectedEmailCustomInvoiceId, setSelectedEmailCustomInvoiceId] =
		useState<Id<"customInvoices"> | null>(null);

	const [isStripeInvoiceDialogOpen, setIsStripeInvoiceDialogOpen] = useState(false);
	const [isStripeBillingDialogOpen, setIsStripeBillingDialogOpen] = useState(false);

	const stripeInvoicesResult = useQuery(api.stripeInvoices.listStripeInvoicesForBooking, {
		bookingId: session._id
	});

	const [isEmailingInvoice, setIsEmailingInvoice] = useState(false);
	const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
	const [isSendingStripeInvoice, setIsSendingStripeInvoice] = useState(false);

	const [downloadingLegacyCustomInvoiceId, setDownloadingLegacyCustomInvoiceId] =
		useState<Id<"customInvoices"> | null>(null);

	function setEmailInvoiceDialogOpen(open: boolean) {
		setIsEmailInvoiceDialogOpen(open);

		if (!open) {
			setSelectedEmailCustomInvoiceId(null);
		}
	}

	async function handleDownloadInvoice() {
		setIsDownloadingInvoice(true);

		if (session.packageId) {
			const [packageError, invoice] = await tryCatch(
				getAdminPackageInvoicePdf({ packageId: session.packageId })
			);

			setIsDownloadingInvoice(false);

			if (packageError !== null) {
				toast.error("Unable to generate package invoice.");

				return;
			}

			downloadBlob(new Blob([invoice.content], { type: invoice.contentType }), invoice.filename);
			toast.success("Package invoice download started.");

			return;
		}

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

	async function handleEmailInvoice() {
		setIsEmailingInvoice(true);

		const [error] = await tryCatch(
			sendBookingInvoiceForBooking(
				(() => {
					const request: EmailBookingInvoiceRequest = { bookingId: session._id };

					if (selectedEmailCustomInvoiceId) {
						request.customInvoiceId = selectedEmailCustomInvoiceId;
					}

					return request;
				})()
			)
		);

		setIsEmailingInvoice(false);

		if (error !== null) {
			const reason = error.reason;

			switch (reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");

					return;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to send invoice emails.");

					return;
				case "BOOKING_NOT_FOUND":
					toast.error("That session no longer exists.");

					return;
				case "CUSTOM_INVOICE_NOT_FOUND":
					toast.error("That custom invoice no longer exists.");

					return;
				case "EMAIL_REQUEST_FAILED":
				case "EMAIL_RESPONSE_FAILED":
				case "INVALID_BOOKING_DATA":
				case "INVOICE_EMAIL_RENDER_FAILED":
				case "INVOICE_PDF_RENDER_FAILED":
					toast.error("Unable to send invoice email.");

					return;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while sending the invoice email.");

					return;
				default:
					exhaustiveCheck(reason);
			}
		}

		setEmailInvoiceDialogOpen(false);
		toast.success(`Invoice sent to ${session.email}.`);
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
		customInvoices: customInvoicesResult?.[1] ?? undefined,
		downloadingLegacyCustomInvoiceId,
		handleDownloadInvoice,
		handleDownloadLegacyCustomInvoice,
		handleEmailInvoice,
		handleSendStripeInvoice,
		hasStripeBillingInvoices,
		hasStripeCustomer: Boolean(session.stripeCustomerId),
		isDownloadingInvoice,
		isEmailInvoiceDialogOpen,
		isEmailingInvoice,
		isLegacyCustomInvoicesDialogOpen,
		isSendingStripeInvoice,
		isStripeBillingDialogOpen,
		isStripeInvoiceDialogOpen,
		legacyCustomInvoices,
		selectedEmailCustomInvoiceId,
		setIsEmailInvoiceDialogOpen: setEmailInvoiceDialogOpen,
		setIsLegacyCustomInvoicesDialogOpen,
		setIsStripeBillingDialogOpen,
		setIsStripeInvoiceDialogOpen,
		setSelectedEmailCustomInvoiceId,
		stripeBillingInvoices
	};
}
