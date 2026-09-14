import { useState, type ReactNode } from "react";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CircleX } from "lucide-react";
import { toast } from "sonner";
import CheckedIcon from "#/components/ui/checked-icon";
import { exhaustiveCheck, tryCatch } from "#/lib/result";
import { cn } from "#/lib/utils";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { BookingStatus } from "#studio/components/booking/BookingCompleteDevScenarioPanel";
import { BookingDetails } from "#studio/features/booking-complete/components/BookingDetails";
import type { BookingResultContent } from "#studio/features/booking-complete/lib/booking-result-content";
import { downloadBlob } from "#studio/features/booking-invoice/pdf/download-blob";

type InvoiceDownloadTarget =
	| { kind: "booking"; stripeSessionId: string }
	| { kind: "package"; packageId: Id<"packages"> };

type BookingReceiptErrorReason =
	| NonNullable<
			FunctionReturnType<typeof api.invoices.getBookingReceiptPdfByStripeSessionId>[0]
	  >["reason"]
	| "UNEXPECTED_ERROR";

type PackageInvoiceErrorReason =
	| NonNullable<FunctionReturnType<typeof api.invoices.getPackageInvoicePdfById>[0]>["reason"]
	| "UNEXPECTED_ERROR";

export interface BookingResultProps {
	booking: BookingStatus | null;
	content: BookingResultContent;
	invoiceDownloadTarget?: InvoiceDownloadTarget;
	showBookingDetails?: boolean;
}

export function BookingResult({
	booking,
	content,
	invoiceDownloadTarget,
	showBookingDetails = true
}: BookingResultProps): ReactNode {
	const [isDownloadingDocument, setIsDownloadingDocument] = useState(false);
	const getBookingReceiptPdf = useAction(api.invoices.getBookingReceiptPdfByStripeSessionId);
	const getPackageInvoicePdf = useAction(api.invoices.getPackageInvoicePdfById);

	function handleDownloadDocument(): void {
		if (!invoiceDownloadTarget) {
			return;
		}

		setIsDownloadingDocument(true);

		void (async () => {
			try {
				if (invoiceDownloadTarget.kind === "package") {
					await downloadPackageInvoice(invoiceDownloadTarget.packageId);

					return;
				}

				await downloadBookingReceipt(invoiceDownloadTarget.stripeSessionId);
			} finally {
				setIsDownloadingDocument(false);
			}
		})();
	}

	async function downloadBookingReceipt(stripeSessionId: string): Promise<void> {
		const [error, receipt] = await tryCatch(getBookingReceiptPdf({ stripeSessionId }));

		if (error !== null) {
			handleBookingReceiptError(error.reason);

			return;
		}

		downloadReceiptPdf(receipt);
	}

	async function downloadPackageInvoice(packageId: Id<"packages">): Promise<void> {
		const [error, invoice] = await tryCatch(getPackageInvoicePdf({ packageId }));

		if (error !== null) {
			handlePackageInvoiceError(error.reason);

			return;
		}

		downloadInvoicePdf(invoice);
	}

	return (
		<section className="flex flex-col gap-8">
			<BookingResultContentView
				booking={booking}
				content={content}
				invoiceDownloadTarget={invoiceDownloadTarget}
				isDownloadingDocument={isDownloadingDocument}
				onDownloadDocument={handleDownloadDocument}
			/>
			{showBookingDetails && booking ? <BookingDetails booking={booking} /> : null}
		</section>
	);
}

interface BookingResultContentViewProps {
	booking: BookingStatus | null;
	content: BookingResultContent;
	invoiceDownloadTarget?: InvoiceDownloadTarget;
	isDownloadingDocument: boolean;
	onDownloadDocument: () => void;
}

function BookingResultContentView({
	booking,
	content,
	invoiceDownloadTarget,
	isDownloadingDocument,
	onDownloadDocument
}: BookingResultContentViewProps): ReactNode {
	const hasConfirmedBooking = booking?.status === "confirmed" || booking?.status === "email_failed";
	const isSessionBooking = invoiceDownloadTarget?.kind === "booking";

	const showReceiptDownloadLink = isSessionBooking;

	const showDescription = !hasConfirmedBooking || invoiceDownloadTarget?.kind === "package";

	return (
		<div className="space-y-8">
			<BookingResultHeading
				content={content}
				hasConfirmedBooking={hasConfirmedBooking}
				isPackageBooking={invoiceDownloadTarget?.kind === "package"}
			/>
			{showDescription ? (
				<BookingResultDescription
					content={content}
					invoiceDownloadTarget={invoiceDownloadTarget}
					isDownloadingDocument={isDownloadingDocument}
					onDownloadDocument={onDownloadDocument}
				/>
			) : null}
			{showReceiptDownloadLink ? (
				<p className="max-w-2xl text-base leading-normal text-muted-foreground">
					{getReceiptLeadText({ booking, content })}{" "}
					<DocumentDownloadButton
						documentKind="receipt"
						isDownloading={isDownloadingDocument}
						onDownload={onDownloadDocument}
					/>
					.
				</p>
			) : null}
		</div>
	);
}

function BookingResultHeading({
	content,
	hasConfirmedBooking,
	isPackageBooking
}: {
	content: BookingResultContent;
	hasConfirmedBooking: boolean;
	isPackageBooking: boolean;
}): ReactNode {
	const showSuccessIcon = hasConfirmedBooking || isPackageBooking;

	return (
		<h1 className="font-brand text-2xl font-semibold leading-tight sm:text-3xl md:text-5xl uppercase">
			{showSuccessIcon ? (
				<CheckedIcon
					className="mr-3 inline size-7 -translate-y-1 text-primary sm:size-8 md:size-9"
					aria-hidden="true"
					focusable="false"
				/>
			) : null}
			{content.isBookingCompletionFailure ? (
				<CircleX
					className="mr-3 inline size-7 -translate-y-1 text-destructive sm:size-8 md:size-9"
					aria-hidden
				/>
			) : null}
			{content.title}
		</h1>
	);
}

function BookingResultDescription({
	content,
	invoiceDownloadTarget,
	isDownloadingDocument,
	onDownloadDocument
}: Omit<BookingResultContentViewProps, "booking">): ReactNode {
	return (
		<div className="max-w-2xl space-y-4">
			{content.descriptionHeading ? (
				<h2 className="text-lg font-semibold">{content.descriptionHeading}</h2>
			) : null}
			{content.descriptionSteps ? (
				<ol className="list-decimal space-y-3 pl-5 text-base leading-normal text-muted-foreground">
					{content.descriptionSteps.map((step) => (
						<li key={step.title}>
							<strong className="block font-semibold text-foreground">{step.title}</strong>
							<p>
								{step.description}
								{step.showReceiptDownloadLink && invoiceDownloadTarget ? (
									<>
										{" "}
										<DocumentDownloadButton
											documentKind="invoice"
											isDownloading={isDownloadingDocument}
											onDownload={onDownloadDocument}
										/>
										{step.receiptDownloadLinkSuffix}
									</>
								) : null}
							</p>
						</li>
					))}
				</ol>
			) : (
				<p className="text-base leading-normal text-muted-foreground">{content.description}</p>
			)}
		</div>
	);
}

function DocumentDownloadButton({
	documentKind,
	isDownloading,
	onDownload
}: {
	documentKind: "invoice" | "receipt";
	isDownloading: boolean;
	onDownload: () => void;
}): ReactNode {
	const idleLabel = documentKind === "receipt" ? "download your receipt" : "here";
	const loadingLabel = documentKind === "receipt" ? "Generating receipt" : "generating invoice...";

	return (
		<button
			type="button"
			className={cn(
				"accent-link",
				"inline bg-transparent p-0",
				"text-base font-medium leading-normal text-foreground",
				"disabled:pointer-events-none disabled:opacity-50"
			)}
			disabled={isDownloading}
			onClick={onDownload}>
			{isDownloading ? loadingLabel : idleLabel}
		</button>
	);
}

function downloadReceiptPdf(receipt: {
	content: ArrayBuffer;
	contentType: string;
	filename: string;
}) {
	const content = new Uint8Array(receipt.content);
	const pdfBuffer = new ArrayBuffer(content.byteLength);
	new Uint8Array(pdfBuffer).set(content);
	downloadBlob(new Blob([pdfBuffer], { type: receipt.contentType }), receipt.filename);
	toast.success("Receipt download started.");
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

function handleBookingReceiptError(reason: BookingReceiptErrorReason) {
	switch (reason) {
		case "BOOKING_NOT_FOUND":
			toast.error("Unable to find this booking.");

			return;
		case "BOOKING_NOT_CONFIRMED":
			toast.error("Receipt is only available for confirmed bookings.");

			return;
		case "INVOICE_DOWNLOAD_EXPIRED":
			toast.error(
				"Download link expired. Your receipt should be in your email. Please check there."
			);

			return;
		case "INVALID_BOOKING_DATA":
			toast.error("Unable to generate receipt.");

			return;
		case "RECEIPT_DOWNLOAD_FAILED":
		case "UNEXPECTED_ERROR":
			toast.error("Unable to generate receipt.");

			return;
		default:
			exhaustiveCheck(reason);
	}
}

function handlePackageInvoiceError(reason: PackageInvoiceErrorReason) {
	switch (reason) {
		case "PACKAGE_NOT_FOUND":
			toast.error("Unable to find this package request.");

			return;
		case "INVOICE_DOWNLOAD_EXPIRED":
			toast.error(
				"Download link expired. Your invoice should be in your email. Please check there."
			);

			return;
		case "INVALID_BOOKING_DATA":
			toast.error("Unable to generate invoice.");

			return;
		case "INVOICE_DOWNLOAD_FAILED":
		case "INVOICE_EMAIL_RENDER_FAILED":
		case "UNEXPECTED_ERROR":
			toast.error("Unable to generate invoice.");

			return;
		default:
			exhaustiveCheck(reason);
	}
}

function getReceiptLeadText({
	booking,
	content
}: {
	booking: BookingStatus | null;
	content: BookingResultContent;
}): ReactNode {
	if (booking?.status === "email_failed") {
		return (
			<>
				Your booking is confirmed, but{" "}
				<span className="font-bold text-destructive">we couldn’t email your receipt</span>. You can
			</>
		);
	}

	return `${content.description}, or you can`;
}
