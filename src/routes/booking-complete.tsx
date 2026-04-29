import type { ReactNode } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
	type BookingStatus,
	BookingCompleteDevScenarioPanel,
	buildDevBooking,
	parseBookingCompleteSearch,
} from "#/components/booking/BookingCompleteDevScenarioPanel";
import { Button } from "#/components/ui/button";
import { formatBookingDate, formatTimeValue, getFirstName } from "#/lib/bookingdatetime";
import { api } from "../../convex/_generated/api";

export const Route = createFileRoute("/booking-complete")({
	validateSearch: parseBookingCompleteSearch,
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
		return <Navigate to="/booking-expired" />;
	}

	const resultContent = getBookingResultContent(booking);

	return (
		<BookingStatusLayout
			primaryAction={resultContent.isBookingCompletionFailure ? "contact" : "new_booking"}>
			<BookingResult
				booking={booking}
				content={resultContent}
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
		<main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10">
			{children}

			{showActions ? (
				<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
					<Button
						asChild
						className="w-full sm:w-auto">
						{primaryAction === "contact" ? (
							<a
								href="/contact"
								rel="noreferrer"
								target="_blank">
								Contact us
							</a>
						) : (
							<Link to="/book">Make a new booking</Link>
						)}
					</Button>
					<Button
						asChild
						className="w-full sm:w-auto"
						variant="outline">
						<Link to="/">Return home</Link>
					</Button>
				</div>
			) : null}
		</main>
	);
}

interface BookingResultProps {
	booking: BookingStatus | null;
	content: BookingResultContent;
}

function BookingResult({ booking, content }: BookingResultProps): ReactNode {
	const titleClassName = content.isBookingCompletionFailure
		? "text-2xl font-semibold leading-tight text-destructive sm:text-3xl md:text-4xl"
		: "text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl";

	return (
		<section className="flex flex-col gap-8">
			<div className="space-y-4">
				<h1 className={titleClassName}>{content.title}</h1>
				<p className="max-w-2xl text-base text-muted-foreground">{content.description}</p>
			</div>

			{booking ? <SessionDetails booking={booking} /> : null}
		</section>
	);
}

function BookingProcessing(): ReactNode {
	return (
		<section className="flex flex-col items-center justify-center gap-4 py-20 text-center">
			<div
				className="size-10 animate-spin rounded-full border-2 border-muted border-t-primary"
				aria-hidden="true"
			/>
			<span className="text-2xl font-semibold">Processing your booking</span>
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
	const timeValue = isUnconfirmedBooking ? "Unconfirmed" : formatTimeValue(booking.time);

	return (
		<section className="border-t pt-5 sm:pt-6">
			<h2 className="text-lg font-semibold">Session Details</h2>
			<dl className="mt-4 grid gap-5 text-sm sm:grid-cols-2 sm:gap-4">
				<BookingDetail
					label="Date"
					tone={detailTone}
					value={dateValue}
				/>
				<BookingDetail
					label="Time"
					tone={detailTone}
					value={timeValue}
				/>
				<BookingDetail
					label="Duration"
					value={booking.duration}
				/>
				<BookingDetail
					label="Recording Space"
					value={booking.service}
				/>
				<BookingDetail
					label="Add-ons"
					value={booking.addons.length > 0 ? booking.addons.join(", ") : "None"}
				/>
			</dl>
		</section>
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
						title: "Your payment was received, but that time slot was just taken",
						description:
							"Another booking took that session time before we could confirm it. Please contact us so we can move your booking to another available time.",
						isBookingCompletionFailure: true,
					};

				case "GOOGLE_CALENDAR_CREATE_FAILED":
					return {
						title: "Your payment was received, but your booking was not completed",
						description:
							"A problem related to Google meant we couldn't finish creating your booking. Please contact us so we can finalise the booking for you.",
						isBookingCompletionFailure: true,
					};

				default:
					return {
						title: "Your payment was received, but your booking was not completed",
						description:
							"A problem on our end meant we couldn't finish creating your booking. Please contact us so we can finalise the booking for you.",
						isBookingCompletionFailure: true,
					};
			}
		}

		case "confirmed":
			return {
				title: `Congrats on booking, ${getFirstName(booking.name)}!`,
				description: `Your invoice will be sent to ${booking.email}.`,
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

		default: {
			const unhandledStatus: never = booking.status;

			throw new Error(`Unhandled booking status: ${unhandledStatus}`);
		}
	}
}
