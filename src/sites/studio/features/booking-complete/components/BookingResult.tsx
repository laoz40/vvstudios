import { useState, type ReactNode } from "react";
import { useAction } from "convex/react";
import { CircleX } from "lucide-react";
import { toast } from "sonner";
import CheckedIcon from "#/components/ui/checked-icon";
import { tryCatch } from "#/lib/result";
import { cn } from "#/lib/utils";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type {
	GetBookingInvoicePdfByStripeSessionIdResult,
	GetMultiBookingInvoicePdfByIdResult
} from "#convex/invoices";
import type { BookingStatus } from "#studio/components/booking/BookingCompleteDevScenarioPanel";
import { BookingDetails } from "#studio/features/booking-complete/components/BookingDetails";
import type { BookingResultContent } from "#studio/features/booking-complete/lib/booking-result-content";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";

type InvoiceDownloadTarget =
	| { kind: "booking"; stripeSessionId: string }
	| { kind: "multiBooking"; multiBookingId: Id<"multiBookingPackages"> };

type BookingInvoiceErrorReason =
	| NonNullable<GetBookingInvoicePdfByStripeSessionIdResult[0]>["reason"]
	| "UNEXPECTED_ERROR";
type MultiBookingInvoiceErrorReason =
	| NonNullable<GetMultiBookingInvoicePdfByIdResult[0]>["reason"]
	| "UNEXPECTED_ERROR";

export interface BookingResultProps {
	booking: BookingStatus | null;
	content: BookingResultContent;
	invoiceDownloadTarget?: InvoiceDownloadTarget;
	showBookingDetails?: boolean;
}

function downloadBlob(blob: Blob, filename: string): void {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");

	link.href = url;
	link.download = filename;
	link.click();

	URL.revokeObjectURL(url);
}

export function BookingResult({
	booking,
	content,
	invoiceDownloadTarget,
	showBookingDetails = true
}: BookingResultProps): ReactNode {
	const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
	const getBookingInvoicePdf = useAction(api.invoices.getBookingInvoicePdfByStripeSessionId);
	const getMultiBookingInvoicePdf = useAction(api.invoices.getMultiBookingInvoicePdfById);
	const titleClassName = "text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl";
	const supportReference = booking ? getSupportReference(booking) : null;
	const hasConfirmedBooking = booking?.status === "confirmed" || booking?.status === "email_failed";
	const canDownloadInvoice = Boolean(invoiceDownloadTarget);
	const showErrorIcon = content.isBookingCompletionFailure;
	const showSuccessIcon = hasConfirmedBooking || invoiceDownloadTarget?.kind === "multiBooking";
	const showDescription = !hasConfirmedBooking || invoiceDownloadTarget?.kind === "multiBooking";
	const invoiceLead = getInvoiceLeadText({ booking, content, invoiceDownloadTarget });

	async function handleDownloadInvoice(): Promise<void> {
		if (!invoiceDownloadTarget) {
			return;
		}

		setIsDownloadingInvoice(true);

		try {
			if (invoiceDownloadTarget.kind === "multiBooking") {
				await downloadMultiBookingInvoice(invoiceDownloadTarget.multiBookingId);
				return;
			}

			await downloadBookingInvoice(invoiceDownloadTarget.stripeSessionId);
		} finally {
			setIsDownloadingInvoice(false);
		}
	}

	async function downloadBookingInvoice(stripeSessionId: string): Promise<void> {
		const [error, invoice] = await tryCatch<GetBookingInvoicePdfByStripeSessionIdResult>(
			getBookingInvoicePdf({ stripeSessionId })
		);

		if (error !== null) {
			handleBookingInvoiceError(error.reason);
			return;
		}

		downloadInvoicePdf(invoice);
	}

	async function downloadMultiBookingInvoice(
		multiBookingId: Id<"multiBookingPackages">
	): Promise<void> {
		const [error, invoice] = await tryCatch<GetMultiBookingInvoicePdfByIdResult>(
			getMultiBookingInvoicePdf({ multiBookingId })
		);

		if (error !== null) {
			handleMultiBookingInvoiceError(error.reason);
			return;
		}

		downloadInvoicePdf(invoice);
	}

	return (
		<section className="flex flex-col gap-8">
			<div className="space-y-4">
				<h1 className={titleClassName}>
					{showSuccessIcon ? (
						<CheckedIcon
							className="mr-3 inline size-7 -translate-y-1 text-primary sm:size-8 md:size-9"
							aria-hidden="true"
							focusable="false"
						/>
					) : null}
					{showErrorIcon ? (
						<CircleX
							className="mr-3 inline size-7 -translate-y-1 text-destructive sm:size-8 md:size-9"
							aria-hidden
						/>
					) : null}
					{content.title}
				</h1>
				{showDescription ? (
					<p className="max-w-2xl text-base leading-normal text-muted-foreground">
						{content.description}
					</p>
				) : null}
				{canDownloadInvoice ? (
					<p className="max-w-2xl text-base leading-normal text-muted-foreground">
						{invoiceLead}{" "}
						<button
							type="button"
							className={cn(
								// Invoice download link style
								"accent-link",
								"inline bg-transparent p-0",
								"text-base font-medium leading-normal text-foreground",
								"disabled:pointer-events-none disabled:opacity-50"
							)}
							disabled={isDownloadingInvoice}
							onClick={handleDownloadInvoice}>
							{isDownloadingInvoice ? "generating invoice..." : "here"}
						</button>
						.
					</p>
				) : null}
				{supportReference ? (
					<p className="text-xs text-muted-foreground/80">
						Reference code:{" "}
						<span className="font-medium text-muted-foreground">{supportReference}</span>
					</p>
				) : null}
			</div>

			{showBookingDetails && booking ? <BookingDetails booking={booking} /> : null}
		</section>
	);
}

function downloadInvoicePdf(invoice: {
	content: ArrayBuffer;
	contentType: string;
	filename: string;
}) {
	const content = new Uint8Array(invoice.content);
	const pdfBuffer = new ArrayBuffer(content.byteLength);
	new Uint8Array(pdfBuffer).set(content);
	downloadBlob(new Blob([pdfBuffer], { type: invoice.contentType }), invoice.filename);
	toast.success("Invoice download started.");
}

function handleBookingInvoiceError(reason: BookingInvoiceErrorReason) {
	switch (reason) {
		case "BOOKING_NOT_FOUND":
			toast.error("Unable to find this booking.");
			return;
		case "BOOKING_NOT_CONFIRMED":
			toast.error("Invoice is only available for confirmed bookings.");
			return;
		case "INVOICE_DOWNLOAD_EXPIRED":
			toast.error(
				"Download link expired. Your invoice should be in your email — please check there."
			);
			return;
		case "INVALID_BOOKING_DATA":
			toast.error("Unable to generate invoice.");
			return;
		case "INVOICE_DOWNLOAD_FAILED":
		case "UNEXPECTED_ERROR":
			toast.error("Unable to generate invoice.");
			return;
	}
}

function handleMultiBookingInvoiceError(reason: MultiBookingInvoiceErrorReason) {
	switch (reason) {
		case "PACKAGE_NOT_FOUND":
			toast.error("Unable to find this package request.");
			return;
		case "PACKAGE_INVOICE_NOT_AVAILABLE":
			toast.error("Invoice is not available for this package request.");
			return;
		case "INVALID_BOOKING_DATA":
			toast.error("Unable to generate invoice.");
			return;
		case "INVOICE_DOWNLOAD_FAILED":
		case "INVOICE_EMAIL_RENDER_FAILED":
		case "UNEXPECTED_ERROR":
			toast.error("Unable to generate invoice.");
			return;
	}
}

function getInvoiceLeadText({
	booking,
	content,
	invoiceDownloadTarget
}: {
	booking: BookingStatus | null;
	content: BookingResultContent;
	invoiceDownloadTarget?: InvoiceDownloadTarget;
}): ReactNode {
	if (invoiceDownloadTarget?.kind === "multiBooking") {
		return "Your invoice has been emailed to you, or you can download it";
	}

	if (booking?.status === "email_failed") {
		return (
			<>
				Your booking is confirmed, but <strong>we couldn’t email your invoice</strong>. You can
				download it
			</>
		);
	}

	return content.description;
}

function getSupportReference(booking: BookingStatus): string | null {
	return Number.isFinite(booking.pendingPaymentCreatedAt)
		? formatBookingInvoiceNumber(booking._id, booking.pendingPaymentCreatedAt)
		: null;
}
