import { useState, type ReactNode } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { ArrowRight, CircleCheck, CircleX, Home, Phone } from "lucide-react";
import { toast } from "sonner";
import {
	type BookingStatus,
	BookingCompleteDevScenarioPanel,
	buildDevBooking,
	parseBookingCompleteSearch,
} from "#studio/components/booking/BookingCompleteDevScenarioPanel";
import { Button } from "#/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { formatBookingInvoiceNumber } from "#studio/features/booking-invoice/lib/build-booking-invoice-data";
import { formatBookingDate, formatBookingTimeRange } from "#studio/lib/bookingdatetime";
import { api } from "#convex/_generated/api";
import { studioSite } from "#/config/sites";
import { buildNoIndexHead } from "#/lib/seo";

export const Route = createFileRoute("/booking-complete")({
	validateSearch: parseBookingCompleteSearch,
	head: () => buildNoIndexHead("Booking Complete | VV Studios"),
	component: BookingCompletePage,
});

function BookingCompletePage(): ReactNode {
	const { dev_scenario: devScenario, session_id: stripeSessionId } = Route.useSearch();
	const activeDevScenario = import.meta.env.DEV ? devScenario : undefined;
	const usableStripeSessionId =
		stripeSessionId && stripeSessionId !== "{CHECKOUT_SESSION_ID}" ? stripeSessionId : null;
	const liveBooking = useQuery(
		api.bookings.getBookingStatusByStripeSessionId,
		usableStripeSessionId && !activeDevScenario
			? { stripeSessionId: usableStripeSessionId }
			: "skip",
	);
	const booking = activeDevScenario ? buildDevBooking(activeDevScenario) : liveBooking;
	const isLoading =
		!activeDevScenario && Boolean(usableStripeSessionId) && liveBooking === undefined;

	if (!stripeSessionId && !activeDevScenario) {
		return (
			<BookingStatusLayout>
				{import.meta.env.DEV ? <BookingCompleteDevScenarioPanel /> : null}
				<BookingResult
					booking={null}
					content={{
						title: "No booking session was provided",
						description:
							"This page needs a valid booking session link. Try returning to the booking form to start a new checkout session.",
						isBookingCompletionFailure: false,
					}}
				/>
			</BookingStatusLayout>
		);
	}

	if (isLoading) {
		return (
			<BookingStatusLayout showActions={false}>
				<BookingProcessing />
			</BookingStatusLayout>
		);
	}

	if (!booking) {
		return (
			<BookingStatusLayout>
				<BookingResult
					booking={null}
					content={{
						title: "We couldn't find this booking",
						description: "The link may be invalid or no longer available.",
						isBookingCompletionFailure: false,
					}}
				/>
			</BookingStatusLayout>
		);
	}

	if (booking.status === "pending_payment") {
		return (
			<BookingStatusLayout showActions={false}>
				<BookingProcessing />
			</BookingStatusLayout>
		);
	}

	if (booking.status === "expired") {
		return (
			<Navigate
				to={studioSite.routes.bookingExpired}
				search={{ session_id: usableStripeSessionId ?? undefined }}
			/>
		);
	}

	const resultContent = getBookingResultContent(booking);

	return (
		<BookingStatusLayout
			primaryAction={resultContent.isBookingCompletionFailure ? "contact" : "new_booking"}>
			<BookingResult
				booking={booking}
				content={resultContent}
				stripeSessionId={usableStripeSessionId}
			/>
		</BookingStatusLayout>
	);
}

interface BookingStatusLayoutProps {
	children: ReactNode;
	primaryAction?: "contact" | "new_booking";
	showActions?: boolean;
}

function BookingStatusLayout({
	children,
	primaryAction = "new_booking",
	showActions = true,
}: BookingStatusLayoutProps): ReactNode {
	return (
		<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10">
			{children}
			{import.meta.env.DEV ? <BookingCompleteDevScenarioPanel /> : null}

			{showActions ? (
				<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
					<Button
						asChild
						size="lg"
						className="h-auto w-full px-8 py-3 text-base font-medium shadow-lg shadow-primary/45 sm:w-auto">
						{primaryAction === "contact" ? (
							<a
								href={studioSite.routes.contact}
								rel="noreferrer"
								target="_blank">
								<Phone
									className="stroke-2"
									aria-hidden
								/>
								Contact us
							</a>
						) : (
							<Link to={studioSite.routes.book}>
								Make a new booking
								<ArrowRight
									className="translate-y-px stroke-3"
									aria-hidden
								/>
							</Link>
						)}
					</Button>
					<Button
						asChild
						size="lg"
						className="h-auto w-full border-0 bg-background/60 px-8 py-3 text-base font-medium shadow-md shadow-background/25 hover:bg-background/75 sm:w-auto"
						variant="outline">
						<Link to={studioSite.routes.home}>
							<Home aria-hidden />
							Return home
						</Link>
					</Button>
				</div>
			) : null}
		</main>
	);
}

interface BookingResultProps {
	booking: BookingStatus | null;
	content: BookingResultContent;
	stripeSessionId?: string | null;
}

function downloadBlob(blob: Blob, filename: string) {
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");

	link.href = url;
	link.download = filename;
	link.click();

	URL.revokeObjectURL(url);
}

function BookingResult({ booking, content, stripeSessionId }: BookingResultProps): ReactNode {
	const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
	const getBookingInvoicePdf = useAction(api.invoices.getBookingInvoicePdfByStripeSessionId);
	const titleClassName = "text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl";
	const supportReference = booking ? getSupportReference(booking) : null;
	const canDownloadInvoice = booking?.status === "confirmed";
	const showErrorIcon = content.isBookingCompletionFailure;
	const showSuccessIcon = booking?.status === "confirmed";

	async function handleDownloadInvoice() {
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

			{booking ? <SessionDetails booking={booking} /> : null}
		</section>
	);
}

function getSupportReference(booking: BookingStatus): string | null {
	return Number.isFinite(booking.pendingPaymentCreatedAt)
		? formatBookingInvoiceNumber(booking._id, booking.pendingPaymentCreatedAt)
		: null;
}

function BookingProcessing(): ReactNode {
	return (
		<section className="flex flex-col items-center justify-center gap-4 py-20 text-center">
			<div
				className="size-10 animate-spin rounded-full border-2 border-muted border-t-primary"
				aria-hidden="true"
			/>
			<span className="text-2xl font-semibold">Checking booking status</span>
		</section>
	);
}

interface SessionDetailsProps {
	booking: BookingStatus;
}

function SessionDetails({ booking }: SessionDetailsProps): ReactNode {
	const isUnconfirmedBooking = booking.status === "failed";
	const detailTone = isUnconfirmedBooking ? "destructive" : "default";
	const dateValue = isUnconfirmedBooking ? "Unconfirmed" : formatBookingDate(booking.date);
	const timeValue = isUnconfirmedBooking
		? "Unconfirmed"
		: formatBookingTimeRange(booking.time, booking.duration);

	return (
		<section className="border-t pt-5 sm:pt-6">
			<h2 className="text-lg font-semibold">Booking Details</h2>
			<dl className="mt-4 grid gap-5 text-sm sm:grid-cols-2 sm:gap-4">
				<BookingDetail
					label="Recording Space"
					value={booking.service}
				/>
				<BookingDetail
					label="Add-ons"
					value={booking.addons.length > 0 ? booking.addons.join(", ") : "None"}
				/>
			</dl>
			<BookingSessionTable
				dateValue={dateValue}
				durationValue={booking.duration}
				timeValue={timeValue}
				tone={detailTone}
			/>
		</section>
	);
}

interface BookingSessionTableProps {
	dateValue: string;
	durationValue: string;
	timeValue: string;
	tone: "default" | "destructive";
}

function BookingSessionTable({
	dateValue,
	durationValue,
	timeValue,
	tone,
}: BookingSessionTableProps): ReactNode {
	const valueClassName = tone === "destructive" ? "font-medium text-destructive" : "font-medium";
	const headerClassName = "text-muted-foreground/80 text-sm font-medium";

	return (
		<div className="mt-5 overflow-hidden rounded-lg bg-muted/60 ring-1 ring-border/70">
			<Table>
				<TableHeader>
					<TableRow className="hover:bg-transparent">
						<TableHead className={headerClassName}>Session</TableHead>
						<TableHead className={headerClassName}>Date</TableHead>
						<TableHead className={headerClassName}>Time</TableHead>
						<TableHead className={headerClassName}>Duration</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					<TableRow className="border-0 hover:bg-background/40">
						<TableCell className={valueClassName}>1</TableCell>
						<TableCell className={valueClassName}>{dateValue}</TableCell>
						<TableCell className={valueClassName}>{timeValue}</TableCell>
						<TableCell className={valueClassName}>{durationValue}</TableCell>
					</TableRow>
				</TableBody>
			</Table>
		</div>
	);
}

interface BookingDetailProps {
	label: string;
	tone?: "default" | "destructive";
	value: string;
}

function BookingDetail({ label, tone = "default", value }: BookingDetailProps): ReactNode {
	const valueClassName = tone === "destructive" ? "font-medium text-destructive" : "font-medium";

	return (
		<div className="flex flex-col gap-1">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className={valueClassName}>{value}</dd>
		</div>
	);
}

interface BookingResultContent {
	description: string;
	isBookingCompletionFailure: boolean;
	title: string;
}

function getBookingResultContent(booking: BookingStatus): BookingResultContent {
	switch (booking.status) {
		case "failed": {
			switch (booking.bookingFailureCode) {
				case "BOOKING_TIME_UNAVAILABLE":
					return {
						title: "We received your payment and need to adjust your booking time",
						description:
							"This time slot became unavailable while checkout was finishing. Please contact us and we’ll help move your booking to a time that works for you.",
						isBookingCompletionFailure: true,
					};

				case "GOOGLE_CALENDAR_CREATE_FAILED":
					return {
						title: "We received your payment and need to confirm your booking manually",
						description:
							"Your payment went through, but the calendar event could not be created automatically. Please contact us and we’ll finalise the booking for you.",
						isBookingCompletionFailure: true,
					};

				default:
					return {
						title: "We received your payment and need to confirm your booking manually",
						description:
							"Your payment went through, but the booking could not be completed automatically. Please contact us and we’ll finalise it for you.",
						isBookingCompletionFailure: true,
					};
			}
		}

		case "confirmed":
			return {
				title: "Congrats, your booking is confirmed!",
				description: "Your invoice has been emailed to you, or you can download it",
				isBookingCompletionFailure: false,
			};

		case "pending_payment":
			return {
				title: "Processing booking",
				description: "We’re still checking your payment.",
				isBookingCompletionFailure: false,
			};

		case "expired":
			return {
				title: "This booking session has expired",
				description: "Please return to the booking form to start a new checkout session.",
				isBookingCompletionFailure: false,
			};

		default:
			throw new Error(`Unhandled booking status: ${booking.status}`);
	}
}
