import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	clearSubmittedBooking,
	readSubmittedBooking,
	type SubmittedBooking,
} from "#/features/booking-form/lib/submitted-booking";

export const Route = createFileRoute("/booking-complete")({
	component: BookingCompletePage,
});

function BookingCompletePage() {
	const [submittedBooking, setSubmittedBooking] = useState<SubmittedBooking | null>(null);

	useEffect(() => {
		setSubmittedBooking(readSubmittedBooking());
	}, []);

	return (
		<main className="mx-auto flex max-w-3xl flex-col gap-8 py-8">
			<div className="flex flex-col gap-2">
				<h1 className="text-3xl font-semibold">Booking confirmed</h1>
				<p className="text-muted-foreground">You may close this tab now.</p>
			</div>

			<div className="flex flex-col gap-4 rounded-lg border bg-card p-6 text-card-foreground shadow-sm">
				<p>
					{submittedBooking
						? `Thank you for booking, ${submittedBooking.name}. We’ve received your session details.`
						: "Thank you for booking. We’ve received your session details."}
				</p>

				{submittedBooking ? (
					<div className="grid gap-3 sm:grid-cols-2">
						<BookingDetail
							label="Service"
							value={submittedBooking.service}
						/>
						<BookingDetail
							label="Phone"
							value={submittedBooking.phone}
						/>
						<BookingDetail
							label="Account Name"
							value={submittedBooking.accountName}
						/>
						<BookingDetail
							label="ABN"
							value={submittedBooking.abn || "—"}
						/>
						<BookingDetail
							label="Invoice Email"
							value={submittedBooking.email}
						/>
						<BookingDetail
							label="Date"
							value={submittedBooking.date}
						/>
						<BookingDetail
							label="Time"
							value={submittedBooking.time}
						/>
						<BookingDetail
							label="Duration"
							value={submittedBooking.duration}
						/>
						<BookingDetail
							label="Add-ons"
							value={
								submittedBooking.addons.length > 0 ? submittedBooking.addons.join(", ") : "None"
							}
						/>
					</div>
				) : (
					<p className="text-sm text-muted-foreground">
						Booking details are not available in this tab anymore.
					</p>
				)}
			</div>

			<div className="flex flex-wrap gap-3">
				<Button
					asChild
					variant="outline">
					<Link
						to="/"
						onClick={() => {
							clearSubmittedBooking();
						}}>
						Return home
					</Link>
				</Button>
				<Button asChild>
					<Link
						to="/book"
						onClick={() => {
							clearSubmittedBooking();
						}}>
						Make a new booking
					</Link>
				</Button>
			</div>
		</main>
	);
}

function BookingDetail({ label, value }: { label: string; value: string }) {
	return (
		<div className="bg-background">
			<p className="text-sm text-muted-foreground">{label}</p>
			<p className="font-medium">{value}</p>
		</div>
	);
}
