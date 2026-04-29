import type { ReactNode } from "react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Button } from "#/components/ui/button";
import { formatTimeValue, parseDateValue } from "#/lib/bookingdatetime";
import { api } from "../../convex/_generated/api";

const DEV_BOOKING_SCENARIOS = [
	"confirmed",
	"processing",
	"expired",
	"slot_taken",
	"calendar_failed",
] as const;

type DevBookingScenario = (typeof DEV_BOOKING_SCENARIOS)[number];

interface BookingCompleteSearch {
	dev_scenario?: DevBookingScenario;
	session_id?: string;
}

export const Route = createFileRoute("/booking-complete")({
	validateSearch: (search): BookingCompleteSearch => ({
		dev_scenario: parseDevBookingScenario(search.dev_scenario),
		session_id:
			typeof search.session_id === "string" && search.session_id.length > 0
				? search.session_id
				: undefined,
	}),
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
				{import.meta.env.DEV ? <DevScenarioPanel /> : null}
				<BookingResult
					booking={null}
					paymentReceived={false}
					title="Booking session not found"
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
					paymentReceived={false}
					title="There is an error with your booking"
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
	const isBookingCompletionFailure = booking.status === "failed";
	const bookingFailureContent = getBookingFailureContent(booking.bookingFailureCode);

	return (
		<BookingStatusLayout>
			<BookingResult
				booking={booking}
				description={isBookingCompletionFailure ? bookingFailureContent.description : undefined}
				isBookingCompletionFailure={isBookingCompletionFailure}
				paymentReceived={paymentReceived}
				title={
					booking.status === "confirmed"
						? `Congrats on booking, ${getFirstName(booking.name)}!`
						: bookingFailureContent.title
				}
			/>
		</BookingStatusLayout>
	);
}

function BookingStatusLayout({
	children,
	showActions = true,
}: {
	children: ReactNode;
	showActions?: boolean;
}) {
	return (
		<main className="mx-auto flex max-w-3xl flex-col gap-8 py-10">
			{children}

			{showActions ? (
				<div className="flex flex-wrap gap-3">
					<Button asChild>
						<Link to="/book">Make a new booking</Link>
					</Button>
					<Button
						asChild
						variant="outline">
						<Link to="/">Return home</Link>
					</Button>
				</div>
			) : null}
		</main>
	);
}

function DevScenarioPanel() {
	return (
		<section className="rounded-xl border border-border bg-card p-6">
			<div className="space-y-2">
				<h2 className="text-lg font-semibold">Dev booking scenarios</h2>
				<p className="text-sm text-muted-foreground">
					Use these preview links to test the booking result states without Stripe or Google
					Calendar.
				</p>
			</div>
			<div className="mt-4 flex flex-wrap gap-3">
				<Button
					asChild
					size="sm"
					variant="outline">
					<Link
						to="/booking-complete"
						search={{ dev_scenario: "processing" }}>
						Processing
					</Link>
				</Button>
				<Button
					asChild
					size="sm"
					variant="outline">
					<Link
						to="/booking-complete"
						search={{ dev_scenario: "confirmed" }}>
						Confirmed
					</Link>
				</Button>
				<Button
					asChild
					size="sm"
					variant="outline">
					<Link
						to="/booking-complete"
						search={{ dev_scenario: "expired" }}>
						Expired
					</Link>
				</Button>
				<Button
					asChild
					size="sm"
					variant="outline">
					<Link
						to="/booking-complete"
						search={{ dev_scenario: "slot_taken" }}>
						Slot Taken
					</Link>
				</Button>
				<Button
					asChild
					size="sm"
					variant="outline">
					<Link
						to="/booking-complete"
						search={{ dev_scenario: "calendar_failed" }}>
						Calendar Failed
					</Link>
				</Button>
			</div>
		</section>
	);
}

interface BookingResultProps {
	booking: BookingStatus | null;
	description?: string;
	isBookingCompletionFailure?: boolean;
	paymentReceived: boolean;
	title: string;
}

function BookingResult({
	booking,
	description,
	isBookingCompletionFailure = false,
	paymentReceived,
	title,
}: BookingResultProps) {
	return (
		<section className="flex flex-col gap-8">
			<div className="space-y-4">
				<h1 className="text-3xl font-semibold leading-tight md:text-5xl">{title}</h1>
				<p className="max-w-2xl text-base text-muted-foreground">
					{isBookingCompletionFailure
						? description
						: paymentReceived
							? "Your booking deposit payment was received."
							: "Your booking was unsuccessful."}
				</p>
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
	return (
		<section className="border-t pt-6">
			<h2 className="text-lg font-semibold">Session details</h2>
			<dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
				<BookingDetail
					label="Session date"
					value={formatBookingDate(booking.date)}
				/>
				<BookingDetail
					label="Time"
					value={formatTimeValue(booking.time)}
				/>
				<BookingDetail
					label="Duration"
					value={booking.duration}
				/>
				<BookingDetail
					label="Studio"
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
	value: string;
}

function BookingDetail({ label, value }: BookingDetailProps) {
	return (
		<div className="flex flex-col gap-1">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="font-medium">{value}</dd>
		</div>
	);
}

function formatBookingDate(dateValue: string) {
	const date = parseDateValue(dateValue);
	if (!date) {
		return dateValue;
	}

	return new Intl.DateTimeFormat("en-AU", {
		dateStyle: "full",
	}).format(date);
}

function getFirstName(name: string) {
	return name.trim().split(/\s+/)[0] || name;
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

function parseDevBookingScenario(value: unknown): DevBookingScenario | undefined {
	return typeof value === "string" && (DEV_BOOKING_SCENARIOS as readonly string[]).includes(value)
		? (value as DevBookingScenario)
		: undefined;
}

function buildDevBooking(devScenario: DevBookingScenario): BookingStatus {
	const now = Date.now();
	const baseBooking: BookingStatus = {
		_id: "dev-booking" as BookingStatus["_id"],
		abn: "",
		accountName: "VV Studios",
		addons: ["4K UHD Recording"],
		bookingConfirmedAt: undefined,
		bookingFailureCode: undefined,
		checkoutExpiredAt: undefined,
		date: "2026-05-12",
		duration: "2h",
		email: "test@example.com",
		name: "Test Booker",
		notes: "Dev-only booking scenario preview.",
		paymentCompletedAt: undefined,
		phone: "0400 000 000",
		service: "Table Setup",
		status: "pending_payment",
		time: "10:00",
	};

	if (devScenario === "processing") {
		return baseBooking;
	}

	if (devScenario === "confirmed") {
		return {
			...baseBooking,
			bookingConfirmedAt: now,
			paymentCompletedAt: now,
			status: "confirmed",
		};
	}

	if (devScenario === "expired") {
		return {
			...baseBooking,
			checkoutExpiredAt: now,
			status: "expired",
		};
	}

	if (devScenario === "slot_taken") {
		return {
			...baseBooking,
			bookingFailureCode: "BOOKING_TIME_UNAVAILABLE",
			paymentCompletedAt: now,
			status: "failed",
		};
	}

	return {
		...baseBooking,
		bookingFailureCode: "GOOGLE_CALENDAR_CREATE_FAILED",
		paymentCompletedAt: now,
		status: "failed",
	};
}

type BookingStatus = NonNullable<
	ReturnType<typeof useQuery<typeof api.bookings.getBookingStatusByStripeSessionId>>
>;
