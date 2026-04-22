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
				<BookingStatusPanel
					title="Missing booking reference"
					description="We could not find a Stripe session in this return link."
				/>
			</BookingStatusLayout>
		);
	}

	if (isLoading) {
		return (
			<BookingStatusLayout>
				<BookingStatusPanel
					title="Confirming your payment..."
					description="Imagine a loading spinner right here 😉"
				/>
			</BookingStatusLayout>
		);
	}

	if (!booking) {
		return (
			<BookingStatusLayout>
				<BookingStatusPanel
					title="Invalid booking reference"
					description="This return link does not match a booking in our system. If you were charged, please contact VV Studios with your payment receipt."
				/>
			</BookingStatusLayout>
		);
	}

	return (
		<BookingStatusLayout>
			<BookingStatusPanel
				title={getBookingStatusTitle(booking.status)}
				description={getBookingStatusDescription(booking.status, booking.bookingFailureCode)}
			/>

			<div className="grid gap-4 md:grid-cols-2">
				<section className="rounded-lg border bg-card p-5">
					<h2 className="text-base font-semibold">Booking details</h2>
					<dl className="mt-4 space-y-3 text-sm">
						<BookingDetail
							label="Name"
							value={booking.name}
						/>
						<BookingDetail
							label="Email"
							value={booking.email}
						/>
						<BookingDetail
							label="Phone"
							value={booking.phone}
						/>
						<BookingDetail
							label="Account name"
							value={booking.accountName}
						/>
						<BookingDetail
							label="ABN"
							value={booking.abn ?? "—"}
						/>
						<BookingDetail
							label="Service"
							value={booking.service}
						/>
						<BookingDetail
							label="Duration"
							value={booking.duration}
						/>
						<BookingDetail
							label="Date"
							value={formatBookingDate(booking.date)}
						/>
						<BookingDetail
							label="Time"
							value={formatTimeValue(booking.time)}
						/>
						<BookingDetail
							label="Add-ons"
							value={booking.addons.length > 0 ? booking.addons.join(", ") : "—"}
						/>
						<BookingDetail
							label="Notes"
							value={booking.notes ?? "—"}
						/>
					</dl>
				</section>

				<section className="rounded-lg border bg-card p-5">
					<h2 className="text-base font-semibold">Payment status</h2>
					<dl className="mt-4 space-y-3 text-sm">
						<BookingDetail
							label="Status"
							value={formatStatusLabel(booking.status)}
						/>
						<BookingDetail
							label="Booking confirmed"
							value={formatTimestamp(booking.bookingConfirmedAt)}
						/>
					</dl>
				</section>
			</div>
		</BookingStatusLayout>
	);
}

function BookingStatusLayout({ children }: { children: React.ReactNode }) {
	return (
		<main className="mx-auto flex max-w-4xl flex-col gap-6 py-8">
			<div className="flex flex-col gap-2">
				<h1 className="text-3xl font-semibold">Booking status</h1>
			</div>

			{children}

			<div className="flex flex-wrap gap-3">
				<Button
					asChild
					variant="outline">
					<Link to="/">Return home</Link>
				</Button>
				<Button asChild>
					<Link to="/book">Make a new booking</Link>
				</Button>
			</div>
		</main>
	);
}

interface BookingStatusPanelProps {
	title: string;
	description: string;
}

function BookingStatusPanel({ title, description }: BookingStatusPanelProps) {
	return (
		<section className="rounded-lg border bg-card p-5">
			<h2 className="text-lg font-semibold">{title}</h2>
			<p className="mt-2 text-sm text-muted-foreground">{description}</p>
		</section>
	);
}

interface BookingDetailProps {
	label: string;
	value: string;
}

function BookingDetail({ label, value }: BookingDetailProps) {
	return (
		<div className="flex flex-col gap-1 border-b pb-3 last:border-b-0 last:pb-0">
			<dt className="text-muted-foreground">{label}</dt>
			<dd className="font-medium">{value}</dd>
		</div>
	);
}

function getBookingStatusTitle(status: string) {
	if (status === "confirmed") {
		return "Thank you for booking our studio!";
	}

	if (status === "failed") {
		return "Payment received, booking needs review";
	}

	if (status === "expired") {
		return "Checkout expired";
	}

	return "Confirming your payment...";
}

function getBookingStatusDescription(status: string, failureCode?: string) {
	if (status === "confirmed") {
		return "Your $50 deposit was received and your booking is confirmed.";
	}

	if (status === "failed") {
		return failureCode
			? `Your payment succeeded, but booking finalisation failed with code ${failureCode}. Please contact VV Studios so we can finish or refund it.`
			: "Your payment succeeded, but booking finalisation failed. Please contact VV Studios so we can finish or refund it.";
	}

	if (status === "expired") {
		return "This payment session expired before checkout completed. You can return to the booking page and start again.";
	}

	return "Stripe has redirected you back, but the webhook may still be confirming your booking. This page will update automatically.";
}

function formatStatusLabel(status: string) {
	if (status === "pending_payment") {
		return "Confirming";
	}

	return status.replaceAll("_", " ");
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

function formatTimestamp(timestamp?: number) {
	if (!timestamp) {
		return "—";
	}

	return new Intl.DateTimeFormat("en-AU", {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(new Date(timestamp));
}
