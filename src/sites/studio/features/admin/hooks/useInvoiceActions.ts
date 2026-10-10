import { useState } from "react";
import { useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { exhaustiveCheck, tryCatch } from "#/lib/result";
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

export function useInvoiceActions(session: SessionRecord) {
	const bookingSettings = useQuery(api.booking.settings.get, {});
	const [isLegacyCustomInvoicesDialogOpen, setIsLegacyCustomInvoicesDialogOpen] = useState(false);

	const customInvoicesResult = useQuery(
		api.stripe.customInvoices.listCustomInvoicesForBooking,
		isLegacyCustomInvoicesDialogOpen ? { bookingId: session._id } : "skip"
	);

	const [isStripeBillingDialogOpen, setIsStripeBillingDialogOpen] = useState(false);

	const stripeInvoicesResult = useQuery(api.stripe.stripeInvoices.listStripeInvoicesForBooking, {
		bookingId: session._id
	});

	const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

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

	const { hasStripeBillingInvoices, stripeBillingInvoices } = getStripeBillingInvoicesState(
		stripeInvoicesResult,
		isStripeBillingDialogOpen
	);

	return {
		downloadingLegacyCustomInvoiceId,
		handleDownloadInvoice,
		handleDownloadLegacyCustomInvoice,
		hasStripeBillingInvoices,
		hasStripeCustomer: Boolean(session.stripeCustomerId),
		isDownloadingInvoice,
		isLegacyCustomInvoicesDialogOpen,
		isStripeBillingDialogOpen,
		legacyCustomInvoices,
		setIsLegacyCustomInvoicesDialogOpen,
		setIsStripeBillingDialogOpen,
		stripeBillingInvoices
	};
}
