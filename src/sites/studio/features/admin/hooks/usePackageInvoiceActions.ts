import { useState, type Dispatch, type SetStateAction } from "react";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { exhaustiveCheck, tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { mapPackageCustomInvoicesToListItems } from "#studio/features/admin/lib/legacy-custom-invoices";
import type { ParsedStripeInvoiceLineItem } from "#studio/features/admin/lib/stripe-invoice-line-items";
import type {
	AdminPackagePendingAction,
	AdminPackageRow
} from "#studio/features/admin/lib/admin-packages";
import { downloadBlob } from "#studio/features/booking-invoice/pdf/download-blob";

type SetPackagePendingAction = Dispatch<SetStateAction<AdminPackagePendingAction>>;

function showSendStripeInvoiceError(reason: string) {
	switch (reason) {
		case "NOT_AUTHENTICATED":
			toast.error("You are not signed in.");

			return;
		case "NOT_AUTHORIZED":
			toast.error("You do not have access to send Stripe invoices.");

			return;
		case "PACKAGE_NOT_FOUND":
			toast.error("This package no longer exists.");

			return;
		case "STRIPE_CUSTOMER_NOT_FOUND":
			toast.error("This package has no Stripe customer ID.");

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

export function usePackageInvoiceActions(
	packageRow: AdminPackageRow,
	setPendingAction: SetPackagePendingAction
) {
	const getAdminPackageInvoicePdf = useAction(api.invoices.getAdminPackageInvoicePdfById);
	const getCustomPackageInvoicePdf = useAction(api.invoices.getAdminCustomPackageInvoicePdfById);
	const sendPackageStripeInvoice = useAction(api.stripeInvoicing.sendPackageStripeInvoice);
	const [isStripeInvoiceDialogOpen, setIsStripeInvoiceDialogOpen] = useState(false);
	const [isLegacyCustomInvoicesDialogOpen, setIsLegacyCustomInvoicesDialogOpen] = useState(false);
	const [isSendingStripeInvoice, setIsSendingStripeInvoice] = useState(false);

	const [downloadingLegacyCustomInvoiceId, setDownloadingLegacyCustomInvoiceId] =
		useState<Id<"customInvoices"> | null>(null);

	const customInvoicesResult = useQuery(
		api.customInvoices.listCustomInvoicesForPackage,
		isLegacyCustomInvoicesDialogOpen ? { packageId: packageRow.id } : "skip"
	);

	const customInvoices = customInvoicesResult?.[1];

	const legacyCustomInvoices =
		customInvoices === undefined || customInvoices === null
			? undefined
			: mapPackageCustomInvoicesToListItems(customInvoices, packageRow);

	async function handleDownloadInvoice() {
		setPendingAction("download");

		const [error, invoice] = await tryCatch(
			getAdminPackageInvoicePdf({ packageId: packageRow.id })
		);

		if (error !== null) {
			const reason = error.reason;

			switch (reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to download package invoices.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package no longer exists.");
					break;

				case "INVALID_BOOKING_DATA":
				case "INVOICE_PDF_RENDER_FAILED":
				case "INVOICE_EMAIL_RENDER_FAILED":
				case "UNEXPECTED_ERROR":
					toast.error("Unable to generate package invoice.");
					break;
				default:
					exhaustiveCheck(reason);
			}

			setPendingAction(null);

			return;
		}

		downloadBlob(new Blob([invoice.content], { type: invoice.contentType }), invoice.filename);
		toast.success("Package invoice download started.");
		setPendingAction(null);
	}

	async function handleDownloadLegacyCustomInvoice(customInvoiceId: Id<"customInvoices">) {
		setDownloadingLegacyCustomInvoiceId(customInvoiceId);

		const [error, invoice] = await tryCatch(getCustomPackageInvoicePdf({ customInvoiceId }));

		setDownloadingLegacyCustomInvoiceId(null);

		if (error !== null) {
			const reason = error.reason;

			switch (reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have permission to download custom package invoices.");
					break;

				case "PACKAGE_NOT_FOUND":
					toast.error("This package or custom invoice no longer exists.");
					break;

				case "INVALID_BOOKING_DATA":
				case "INVOICE_PDF_RENDER_FAILED":
				case "INVOICE_EMAIL_RENDER_FAILED":
				case "UNEXPECTED_ERROR":
					toast.error("Unable to generate custom package invoice.");
					break;
				default:
					toast.error("Unable to generate custom package invoice.");
			}

			return;
		}

		downloadBlob(new Blob([invoice.content], { type: invoice.contentType }), invoice.filename);
		toast.success("Custom invoice download started.");
	}

	async function handleSendStripeInvoice(input: {
		lineItems: ParsedStripeInvoiceLineItem[];
		requestId: string;
	}) {
		setIsSendingStripeInvoice(true);

		const [error] = await tryCatch(
			sendPackageStripeInvoice({
				packageId: packageRow.id,
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

	return {
		downloadingLegacyCustomInvoiceId,
		handleDownloadInvoice,
		handleDownloadLegacyCustomInvoice,
		handleSendStripeInvoice,
		hasStripeCustomer: Boolean(packageRow.stripeCustomerId),
		isLegacyCustomInvoicesDialogOpen,
		isSendingStripeInvoice,
		isStripeInvoiceDialogOpen,
		legacyCustomInvoices,
		setIsLegacyCustomInvoicesDialogOpen,
		setIsStripeInvoiceDialogOpen
	};
}
