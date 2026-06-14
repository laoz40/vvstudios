import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { api } from "#convex/_generated/api";
import { buildNoIndexHead } from "#/lib/seo";

export const Route = createFileRoute("/_public/reschedule/$token")({
	head: () => buildNoIndexHead("Reschedule Booking | VV Studios"),
	component: RescheduleTestPage
});

function RescheduleTestPage() {
	const { token } = Route.useParams();
	const result = useQuery(api.bookingReschedule.getRescheduleBookingByToken, { token });

	if (result === undefined) {
		return (
			<main className="mx-auto max-w-2xl px-6 py-16">
				<p className="text-muted-foreground">Checking reschedule link…</p>
			</main>
		);
	}

	const [error, data] = result;

	if (error !== null) {
		return (
			<main className="mx-auto max-w-2xl px-6 py-16">
				<h1 className="text-3xl font-semibold tracking-tight">Reschedule link unavailable</h1>
				<p className="mt-4 text-muted-foreground">
					This reschedule link is no longer valid. Please contact us if you need help changing your
					booking.
				</p>
				<p className="mt-6 rounded-md border bg-muted p-4 text-sm text-muted-foreground">
					Test error: {error.reason}
				</p>
			</main>
		);
	}

	return (
		<main className="mx-auto max-w-2xl px-6 py-16">
			<p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
				Test reschedule page
			</p>
			<h1 className="mt-3 text-3xl font-semibold tracking-tight">
				Your booking can be rescheduled
			</h1>
			<div className="mt-8 space-y-3 rounded-lg border bg-card p-6 text-card-foreground">
				<p>
					<span className="font-medium">Name:</span> {data.booking.name}
				</p>
				<p>
					<span className="font-medium">Date:</span> {data.booking.date}
				</p>
				<p>
					<span className="font-medium">Time:</span> {data.booking.time}
				</p>
				<p>
					<span className="font-medium">Duration:</span> {data.booking.duration}
				</p>
				<p>
					<span className="font-medium">Service:</span> {data.booking.service}
				</p>
				<p>
					<span className="font-medium">Addons:</span>{" "}
					{data.booking.addons.length > 0 ? data.booking.addons.join(", ") : "None"}
				</p>
				<p className="text-sm text-muted-foreground">
					Expires: {new Date(data.expiresAt).toLocaleString()}
				</p>
			</div>
		</main>
	);
}
