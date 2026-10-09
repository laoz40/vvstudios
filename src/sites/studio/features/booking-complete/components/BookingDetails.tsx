import { type ReactNode } from "react";
import type { BookingStatus } from "#studio/components/booking/BookingCompleteDevScenarioPanel";
import { pickBookingAddonQuantities } from "#/domain/booking/addon-quantities";
import { formatEditingAddonList } from "#/domain/booking/addon-quantities";
import { formatBookingDate, formatBookingTimeRange } from "#studio/lib/bookingdatetime";

export type BookingDetailsData = Pick<
	BookingStatus,
	| "status"
	| "date"
	| "time"
	| "duration"
	| "service"
	| "addons"
	| "essentialEditQuantity"
	| "completeEditQuantity"
	| "clipsPackageQuantity"
	| "handcraftedClipsQuantity"
>;

export interface BookingDetailsProps {
	booking: BookingDetailsData;
}

export function BookingDetails({ booking }: BookingDetailsProps): ReactNode {
	const isUnconfirmedBooking = booking.status === "failed";
	const detailTone = isUnconfirmedBooking ? "destructive" : "default";
	const dateValue = isUnconfirmedBooking ? "Unconfirmed" : formatBookingDate(booking.date);

	const timeValue = isUnconfirmedBooking
		? "Unconfirmed"
		: formatBookingTimeRange(booking.time, booking.duration);

	const addonsValue =
		booking.addons.length > 0
			? formatEditingAddonList(booking.addons, pickBookingAddonQuantities(booking))
			: "None";

	return (
		<section className="border-t pt-5 sm:pt-6">
			<h2 className="text-lg font-semibold">Booking Details</h2>
			<dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-5 text-sm">
				<BookingDetail
					label="Date"
					value={dateValue}
					tone={detailTone}
				/>
				<BookingDetail
					label="Recording Space"
					value={booking.service}
				/>
				<BookingDetail
					label="Time"
					value={timeValue}
					tone={detailTone}
				/>
				<BookingDetail
					label="Add-ons"
					value={addonsValue}
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
