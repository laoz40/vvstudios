import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "#convex/_generated/api";
import { BookingStatusLayout } from "#studio/features/booking-complete/components/BookingStatusLayout";
import { BookingProcessing } from "#studio/features/booking-complete/components/BookingProcessing";
import { formatBookingDate, formatBookingTimeRange } from "#studio/lib/bookingdatetime";
import { buildNoIndexHead } from "#/lib/seo";

export const Route = createFileRoute("/_public/reschedule/$token")({
	head: () => buildNoIndexHead("Reschedule Booking | VV Studios"),
	component: RescheduleTestPage
});

function formatRescheduleExpiry(expiresAt: number) {
	const expiryDate = new Date(expiresAt);
	const time = new Intl.DateTimeFormat("en-AU", {
		hour: "numeric",
		hour12: true,
		minute: "2-digit"
	})
		.format(expiryDate)
		.replace(/\s?(am|pm)$/i, (_, meridiem: string) => meridiem.toUpperCase());
	const date = new Intl.DateTimeFormat("en-AU", {
		day: "numeric",
		month: "long",
		year: "numeric"
	}).format(expiryDate);

	return `${time}, ${date}`;
}

function RescheduleTestPage() {
	const { token } = Route.useParams();
	const result = useQuery(api.bookingReschedule.getRescheduleBookingByToken, { token });

	if (result === undefined) {
		return (
			<BookingStatusLayout showActions={false}>
				<BookingProcessing label="Checking reschedule link" />
			</BookingStatusLayout>
		);
	}

	const [error, data] = result;

	if (error !== null) {
		return (
			<BookingStatusLayout bookingStatus="failed">
				<div>
					<h1 className="text-4xl font-semibold tracking-tight">
						This reschedule link is no longer valid.
					</h1>
					<p className="mt-4 text-muted-foreground">
						Please use the reschedule button in your latest invoice email.
					</p>
				</div>
			</BookingStatusLayout>
		);
	}

	const formattedDate = formatBookingDate(data.booking.date);
	const formattedTime = formatBookingTimeRange(data.booking.time, data.booking.duration);
	const addonsLabel = data.booking.addons.length > 0 ? data.booking.addons.join(", ") : "None";
	const expiresAtLabel = formatRescheduleExpiry(data.expiresAt);

	return (
		<BookingStatusLayout
			showActions={false}
			className="max-w-4xl">
			<div>
				<h1 className="text-center font-brand text-[2.5rem] leading-none uppercase md:text-6xl">
					Reschedule your booking
				</h1>

				<h2 className="mt-6 text-sm font-medium text-muted-foreground">Existing booking</h2>
				<div className="mt-2 rounded-lg border bg-card p-2 text-sm text-card-foreground">
					<dl className="grid gap-2 md:grid-cols-2">
						<div className="space-y-1">
							<div className="flex gap-1.5">
								<dt className="w-16 shrink-0 text-muted-foreground">Date</dt>
								<dd className="font-medium">{formattedDate}</dd>
							</div>
							<div className="flex gap-1.5">
								<dt className="w-16 shrink-0 text-muted-foreground">Time</dt>
								<dd className="font-medium">{formattedTime}</dd>
							</div>
						</div>
						<div className="space-y-1">
							<div className="flex gap-1.5">
								<dt className="w-16 shrink-0 text-muted-foreground">Service</dt>
								<dd className="font-medium">
									{data.booking.service} ({data.booking.duration})
								</dd>
							</div>
							<div className="flex gap-1.5">
								<dt className="w-16 shrink-0 text-muted-foreground">Add-ons</dt>
								<dd className="font-medium">{addonsLabel}</dd>
							</div>
						</div>
					</dl>
				</div>
				<p className="mt-2 text-center text-sm text-muted-foreground">Expires {expiresAtLabel}</p>
			</div>
		</BookingStatusLayout>
	);
}
