import type { ReactNode } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Button } from "#/components/ui/button";
import { formatTimeValue, parseDateValue } from "#/lib/bookingdatetime";
import { api } from "../../convex/_generated/api";

interface BookingCompleteSearch {
	session_id?: string;
}

export const Route = createFileRoute("/booking-complete")({
	validateSearch: (search): BookingCompleteSearch => ({
		session_id:
			typeof search.session_id === "string" && search.session_id.length > 0
				? search.session_id
				: undefined,
	}),
	component: BookingCompletePage,
});

function BookingCompletePage() {
	const { session_id: stripeSessionId } = Route.useSearch();
	const usableStripeSessionId =
		stripeSessionId && stripeSessionId !== "{CHECKOUT_SESSION_ID}" ? stripeSessionId : null;
	const booking = useQuery(
		api.bookings.getBookingStatusByStripeSessionId,
		usableStripeSessionId ? { stripeSessionId: usableStripeSessionId } : "skip",
	);
	const isLoading = Boolean(usableStripeSessionId) && booking === undefined;

	if (!stripeSessionId) {
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

	const paymentReceived = Boolean(booking.paymentCompletedAt) || booking.status === "confirmed";

	return (
		<BookingStatusLayout>
			<BookingResult
				booking={booking}
				paymentReceived={paymentReceived}
				title={
					booking.status === "confirmed"
						? `Congrats on booking, ${getFirstName(booking.name)}!`
						: "There is an error with your booking"
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

interface BookingResultProps {
	booking: BookingStatus | null;
	paymentReceived: boolean;
	title: string;
}

function BookingResult({ booking, paymentReceived, title }: BookingResultProps) {
	return (
		<section className="flex flex-col gap-8">
			<div className="space-y-4">
				<h1 className="text-xl font-semibold leading-tight text-balance md:text-6xl">{title}</h1>
				<p
					className={`max-w-2xl text-lg ${paymentReceived ? "text-muted-foreground" : "text-red-500"}`}>
					{paymentReceived
						? "Your booking deposit payment was received."
						: "Your booking deposit payment was not received."}
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

type BookingStatus = NonNullable<
	ReturnType<typeof useQuery<typeof api.bookings.getBookingStatusByStripeSessionId>>
>;
