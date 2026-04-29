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

function BookingCompletePage() {
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

	const paymentReceived = Boolean(booking.paymentCompletedAt) || booking.status === "confirmed";
	const resultContent = getBookingResultContent({ booking, paymentReceived });

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

function BookingStatusLayout({
	children,
	primaryAction = "new_booking",
	showActions = true,
}: {
	children: ReactNode;
	primaryAction?: "contact" | "new_booking";
	showActions?: boolean;
}) {
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

function BookingResult({ booking, content }: BookingResultProps) {
	return (
		<section className="flex flex-col gap-8">
			<div className="space-y-4">
				<h1
					className={
						content.isBookingCompletionFailure
							? "text-2xl font-semibold leading-tight text-destructive sm:text-3xl md:text-4xl"
							: "text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl"
					}>
					{content.title}
				</h1>
				<p className="max-w-2xl text-base text-muted-foreground">{content.description}</p>
			</div>

			{booking ? <SessionDetails booking={booking} /> : null}
		</section>
	);
}

function BookingProcessing() {
	return (
		<section className="flex flex-col items-center justify-center gap-4 py-20 text-center">
			<div
				className="size-10 animate-spin rounded-full border-2 border-muted border-t-primary"
				aria-hidden="true"
			/>
			<h1 className="text-2xl font-semibold">Processing booking</h1>
			<p className="text-sm text-muted-foreground">Checking your payment.</p>
		</section>
	);
}

function SessionDetails({ booking }: { booking: BookingStatus }) {
	const isUnconfirmedBooking = booking.status === "failed";

	return (
		<section className="border-t pt-5 sm:pt-6">
			<h2 className="text-lg font-semibold">Session Details</h2>
			<dl className="mt-4 grid gap-5 text-sm sm:grid-cols-2 sm:gap-4">
				<BookingDetail
					label="Date"
					tone={isUnconfirmedBooking ? "destructive" : "default"}
					value={isUnconfirmedBooking ? "Unconfirmed" : formatBookingDate(booking.date)}
				/>
				<BookingDetail
					label="Time"
					tone={isUnconfirmedBooking ? "destructive" : "default"}
					value={isUnconfirmedBooking ? "Unconfirmed" : formatTimeValue(booking.time)}
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

function BookingDetail({ label, tone = "default", value }: BookingDetailProps) {
	return (
		<div className="flex flex-col gap-1">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className={tone === "destructive" ? "font-medium text-destructive" : "font-medium"}>
				{value}
			</dd>
		</div>
	);
}

interface BookingResultContent {
	description: string;
	isBookingCompletionFailure: boolean;
	title: string;
}

function getBookingResultContent({
	booking,
	paymentReceived,
}: {
	booking: BookingStatus;
	paymentReceived: boolean;
}): BookingResultContent {
	if (booking.status === "failed") {
		return {
			...getBookingFailureContent(booking.bookingFailureCode),
			isBookingCompletionFailure: true,
		};
	}

	if (paymentReceived && booking?.email) {
		return {
			title: `Congrats on booking, ${getFirstName(booking.name)}!`,
			description: `Your invoice will be sent to ${booking.email}.`,
			isBookingCompletionFailure: false,
		};
	}

	return {
		title: `Congrats on booking, ${getFirstName(booking.name)}!`,
		description: "Your booking was unsuccessful.",
		isBookingCompletionFailure: false,
	};
}

function getBookingFailureContent(bookingFailureCode?: string) {
	if (bookingFailureCode === "BOOKING_TIME_UNAVAILABLE") {
		return {
			title: "Your payment was received, but that time slot was just taken",
			description:
				"Another booking took that session time before we could confirm it. Please contact us so we can move your booking to another available time.",
		};
	}

	if (bookingFailureCode === "GOOGLE_CALENDAR_CREATE_FAILED") {
		return {
			title: "Your payment was received, but your booking was not completed",
			description:
				"A problem related to Google meant we couldn't finish creating your booking. Please contact us so we can finalise the booking for you.",
		};
	}

	return {
		title: "Your payment was received, but your booking was not completed",
		description:
			"A problem on our end meant we couldn't finish creating your booking. Please contact us so we can finalise the booking for you.",
	};
}
