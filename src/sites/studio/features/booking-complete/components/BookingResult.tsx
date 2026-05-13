import { useState, type ReactNode } from "react";
import { useAction } from "convex/react";
import { CircleCheck, CircleX } from "lucide-react";
import { toast } from "sonner";
import type { BookingStatus } from "#studio/components/booking/BookingCompleteDevScenarioPanel";
import { BookingDetails } from "#studio/features/booking-complete/components/BookingDetails";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import type { BookingResultContent } from "#studio/features/booking-complete/lib/booking-result-content";
import { api } from "#convex/_generated/api";

export interface BookingResultProps {
	booking: BookingStatus | null;
	content: BookingResultContent;
	stripeSessionId?: string | null;
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
	stripeSessionId,
}: BookingResultProps): ReactNode {
	const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
	const getBookingInvoicePdf = useAction(api.invoices.getBookingInvoicePdfByStripeSessionId);
	const titleClassName = "text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl";
	const supportReference = booking ? getSupportReference(booking) : null;
	const canDownloadInvoice = booking?.status === "confirmed";
	const showErrorIcon = content.isBookingCompletionFailure;
	const showSuccessIcon = booking?.status === "confirmed";

	async function handleDownloadInvoice(): Promise<void> {
		if (!booking || booking.status !== "confirmed" || !stripeSessionId) {
			return;
		}

		setIsDownloadingInvoice(true);

		try {
			const invoice = await getBookingInvoicePdf({ stripeSessionId });
			const content = new Uint8Array(invoice.content);
			const pdfBuffer = new ArrayBuffer(content.byteLength);
			new Uint8Array(pdfBuffer).set(content);
			downloadBlob(new Blob([pdfBuffer], { type: invoice.contentType }), invoice.filename);
			toast.success("Invoice download started.");
		} catch (error) {
			const message = error instanceof Error ? error.message : "";
			const isExpired = message.includes("INVOICE_DOWNLOAD_EXPIRED");

			toast.error(
				isExpired
					? "Download link expired. Your invoice should be in your email — please check there."
					: "Unable to generate invoice.",
			);
		} finally {
			setIsDownloadingInvoice(false);
		}
	}

	return (
		<section className="flex flex-col gap-8">
			<div className="space-y-4">
				<h1 className={titleClassName}>
					{showSuccessIcon ? (
						<CircleCheck
							className="mr-3 inline size-7 -translate-y-1 text-primary sm:size-8 md:size-9"
							aria-hidden
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
				{canDownloadInvoice ? (
					<p className="max-w-2xl text-base leading-normal text-muted-foreground">
						{content.description}{" "}
						<button
							type="button"
							className="accent-link inline bg-transparent p-0 text-base font-medium leading-normal text-foreground disabled:pointer-events-none disabled:opacity-50"
							disabled={isDownloadingInvoice}
							onClick={handleDownloadInvoice}>
							{isDownloadingInvoice ? "generating invoice..." : "here"}
						</button>
						.
					</p>
				) : (
					<p className="max-w-2xl text-base text-muted-foreground">{content.description}</p>
				)}
				{supportReference ? (
					<p className="text-xs text-muted-foreground/80">
						Reference code:{" "}
						<span className="font-medium text-muted-foreground">{supportReference}</span>
					</p>
				) : null}
			</div>

			{booking ? <BookingDetails booking={booking} /> : null}
		</section>
	);
}

function getSupportReference(booking: BookingStatus): string | null {
	return Number.isFinite(booking.pendingPaymentCreatedAt)
		? formatBookingInvoiceNumber(booking._id, booking.pendingPaymentCreatedAt)
		: null;
}
