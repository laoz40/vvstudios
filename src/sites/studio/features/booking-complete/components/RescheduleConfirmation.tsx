import CheckedIcon from "#/components/ui/checked-icon";
import { formatBookingDate, formatBookingTimeRange } from "#studio/lib/bookingdatetime";

export interface RescheduleConfirmationProps {
	addons: string[];
	date: string;
	duration: string;
	service: string;
	time: string;
}

export function RescheduleConfirmation({
	addons,
	date,
	duration,
	service,
	time
}: RescheduleConfirmationProps) {
	const addonsLabel = addons.length > 0 ? addons.join(", ") : "None";

	return (
		<section className="flex flex-col gap-8">
			<div className="space-y-4">
				<h1 className="text-2xl font-semibold leading-tight sm:text-3xl md:text-4xl">
					<CheckedIcon
						className="mr-3 inline size-7 -translate-y-1 text-primary sm:size-8 md:size-9"
						aria-hidden="true"
						focusable="false"
					/>
					Booking updated
				</h1>
				<p className="max-w-2xl text-base text-muted-foreground">
					Your booking has been rescheduled. Please check your email for the updated details.
				</p>
			</div>

			<section className="border-t pt-5 sm:pt-6">
				<h2 className="text-lg font-semibold">Booking Details</h2>
				<dl className="mt-4 grid gap-5 text-sm sm:grid-cols-2 sm:gap-4">
					<div className="flex flex-col gap-1">
						<dt className="text-muted-foreground">Recording Space</dt>
						<dd className="font-medium">{service}</dd>
					</div>
					<div className="flex flex-col gap-1">
						<dt className="text-muted-foreground">Add-ons</dt>
						<dd className="font-medium">{addonsLabel}</dd>
					</div>
				</dl>

				<div className="mt-5 overflow-hidden rounded-lg bg-muted/60 ring-1 ring-border/70">
					<div className="grid grid-cols-4 gap-3 border-b px-4 py-3 text-sm font-medium text-muted-foreground/80">
						<div>Session</div>
						<div>Date</div>
						<div>Time</div>
						<div>Duration</div>
					</div>
					<div className="grid grid-cols-4 gap-3 px-4 py-3 text-sm font-medium">
						<div>1</div>
						<div>{formatBookingDate(date)}</div>
						<div>{formatBookingTimeRange(time, duration)}</div>
						<div>{duration}</div>
					</div>
				</div>
			</section>
		</section>
	);
}
