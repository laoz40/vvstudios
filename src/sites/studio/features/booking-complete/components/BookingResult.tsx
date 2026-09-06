import { useState, type ReactNode } from "react";
import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CircleX } from "lucide-react";
import { toast } from "sonner";
import CheckedIcon from "#/components/ui/checked-icon";
import { tryCatch } from "#/lib/result";
import { cn } from "#/lib/utils";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import type { BookingStatus } from "#studio/components/booking/BookingCompleteDevScenarioPanel";
import { BookingDetails } from "#studio/features/booking-complete/components/BookingDetails";
import type { BookingResultContent } from "#studio/features/booking-complete/lib/booking-result-content";
import { downloadBlob } from "#studio/features/booking-invoice/pdf/download-blob";

type InvoiceDownloadTarget =
	| { kind: "booking"; stripeSessionId: string }
	| { kind: "multiBooking"; multiBookingId: Id<"multiBookingPackages"> };

type BookingInvoiceErrorReason =
	| NonNullable<
			FunctionReturnType<typeof api.invoices.getBookingInvoicePdfByStripeSessionId>[0]
	  >["reason"]
	| "UNEXPECTED_ERROR";
type MultiBookingInvoiceErrorReason =
	| NonNullable<FunctionReturnType<typeof api.invoices.getMultiBookingInvoicePdfById>[0]>["reason"]
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
	const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
	const getBookingInvoicePdf = useAction(api.invoices.getBookingInvoicePdfByStripeSessionId);
	const getMultiBookingInvoicePdf = useAction(api.invoices.getMultiBookingInvoicePdfById);

	function handleDownloadInvoice(): void {
		if (!invoiceDownloadTarget) {
			return;
		}

		setIsDownloadingInvoice(true);

		void (async () => {
			try {
				if (invoiceDownloadTarget.kind === "multiBooking") {
					await downloadMultiBookingInvoice(invoiceDownloadTarget.multiBookingId);
					return;
				}

				await downloadBookingInvoice(invoiceDownloadTarget.stripeSessionId);
			} finally {
				setIsDownloadingInvoice(false);
			}
		})();
	}

	async function downloadBookingInvoice(stripeSessionId: string): Promise<void> {
		const [error, invoice] = await tryCatch(getBookingInvoicePdf({ stripeSessionId }));

		if (error !== null) {
			handleBookingInvoiceError(error.reason);
			return;
		}

		downloadInvoicePdf(invoice);
	}

	async function downloadMultiBookingInvoice(
		multiBookingId: Id<"multiBookingPackages">
	): Promise<void> {
		const [error, invoice] = await tryCatch(getMultiBookingInvoicePdf({ multiBookingId }));

		if (error !== null) {
			handleMultiBookingInvoiceError(error.reason);
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
				isDownloadingInvoice={isDownloadingInvoice}
				onDownloadInvoice={handleDownloadInvoice}
			/>
			{showBookingDetails && booking ? <BookingDetails booking={booking} /> : null}
		</section>
	);
}

interface BookingResultContentViewProps {
	booking: BookingStatus | null;
	content: BookingResultContent;
	invoiceDownloadTarget?: InvoiceDownloadTarget;
	isDownloadingInvoice: boolean;
	onDownloadInvoice: () => void;
}

function BookingResultContentView({
	booking,
	content,
	invoiceDownloadTarget,
	isDownloadingInvoice,
	onDownloadInvoice
}: BookingResultContentViewProps): ReactNode {
	const hasConfirmedBooking = booking?.status === "confirmed" || booking?.status === "email_failed";
	const showInvoiceDownloadLink =
		Boolean(invoiceDownloadTarget) && invoiceDownloadTarget?.kind !== "multiBooking";
	const showDescription = !hasConfirmedBooking || invoiceDownloadTarget?.kind === "multiBooking";

	return (
		<div className="space-y-8">
			<BookingResultHeading
				content={content}
				hasConfirmedBooking={hasConfirmedBooking}
				isMultiBooking={invoiceDownloadTarget?.kind === "multiBooking"}
			/>
			{showDescription ? (
				<BookingResultDescription
					content={content}
					invoiceDownloadTarget={invoiceDownloadTarget}
					isDownloadingInvoice={isDownloadingInvoice}
					onDownloadInvoice={onDownloadInvoice}
				/>
			) : null}
			{showInvoiceDownloadLink ? (
				<p className="max-w-2xl text-base leading-normal text-muted-foreground">
					{getInvoiceLeadText({ booking, content, invoiceDownloadTarget })}{" "}
					<InvoiceDownloadButton
						isDownloading={isDownloadingInvoice}
						onDownload={onDownloadInvoice}
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
	isMultiBooking
}: {
	content: BookingResultContent;
	hasConfirmedBooking: boolean;
	isMultiBooking: boolean;
}): ReactNode {
	const showSuccessIcon = hasConfirmedBooking || isMultiBooking;

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
	isDownloadingInvoice,
	onDownloadInvoice
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
								{step.showInvoiceDownloadLink && invoiceDownloadTarget ? (
									<>
										{" "}
										<InvoiceDownloadButton
											isDownloading={isDownloadingInvoice}
											onDownload={onDownloadInvoice}
										/>
										{step.invoiceDownloadLinkSuffix}
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

function InvoiceDownloadButton({
	isDownloading,
	onDownload
}: {
	isDownloading: boolean;
	onDownload: () => void;
}): ReactNode {
	return (
		<button
			type="button"
			className={cn(
				// Invoice download link style
				"accent-link",
				"inline bg-transparent p-0",
				"text-base font-medium leading-normal text-foreground",
				"disabled:pointer-events-none disabled:opacity-50"
			)}
			disabled={isDownloading}
			onClick={onDownload}>
			{isDownloading ? "generating invoice..." : "here"}
		</button>
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
		default: {
			const _exhaustive: never = reason;
			void _exhaustive;
			return;
		}
	}
}

function handleMultiBookingInvoiceError(reason: MultiBookingInvoiceErrorReason) {
	switch (reason) {
		case "PACKAGE_NOT_FOUND":
			toast.error("Unable to find this package request.");
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
		case "INVOICE_EMAIL_RENDER_FAILED":
		case "UNEXPECTED_ERROR":
			toast.error("Unable to generate invoice.");
			return;
		default: {
			const _exhaustive: never = reason;
			void _exhaustive;
			return;
		}
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
				Your booking is confirmed, but{" "}
				<span className="font-bold text-destructive">we couldn’t email your invoice</span>. You can
				download it
			</>
		);
	}

	return content.description;
}
