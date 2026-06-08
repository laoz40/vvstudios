import { type ReactNode } from "react";
import type { BookingStatus } from "#studio/components/booking/BookingCompleteDevScenarioPanel";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "#/components/ui/table";
import { formatBookingDate, formatBookingTimeRange } from "#studio/lib/bookingdatetime";

export interface BookingDetailsProps {
	booking: BookingStatus;
}

export function BookingDetails({ booking }: BookingDetailsProps): ReactNode {
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
