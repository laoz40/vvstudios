import { useState, type Dispatch, type SetStateAction } from "react";
import { useAction, useQuery } from "convex/react";
import { toast } from "sonner";
import { tryCatch } from "#/lib/result";
import { api } from "#convex/_generated/api";
import type {
	AdminPackagePendingAction,
	AdminPackageRow
} from "#studio/features/admin/lib/admin-packages";
import { getStripeBillingInvoicesState } from "#studio/features/admin/lib/stripe-invoice-billing";
import type { ParsedStripeInvoiceLineItem } from "#studio/features/admin/lib/stripe-invoice-line-items";

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
	_setPendingAction: SetPackagePendingAction
) {
	const sendPackageStripeInvoice = useAction(api.stripeInvoicing.sendPackageStripeInvoice);
	const [isStripeInvoiceDialogOpen, setIsStripeInvoiceDialogOpen] = useState(false);
	const [isStripeBillingDialogOpen, setIsStripeBillingDialogOpen] = useState(false);

	const stripeInvoicesResult = useQuery(api.stripeInvoices.listStripeInvoicesForPackage, {
		packageId: packageRow.id
	});

	const [isSendingStripeInvoice, setIsSendingStripeInvoice] = useState(false);

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

	const { hasStripeBillingInvoices, stripeBillingInvoices } = getStripeBillingInvoicesState(
		stripeInvoicesResult,
		isStripeBillingDialogOpen
	);

	return {
		handleSendStripeInvoice,
		hasStripeBillingInvoices,
		hasStripeCustomer: Boolean(packageRow.stripeCustomerId),
		isSendingStripeInvoice,
		isStripeBillingDialogOpen,
		isStripeInvoiceDialogOpen,
		setIsStripeBillingDialogOpen,
		setIsStripeInvoiceDialogOpen,
		stripeBillingInvoices
	};
}
