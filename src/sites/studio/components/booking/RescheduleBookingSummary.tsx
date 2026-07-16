import { sectionHeadingClassName } from "#studio/features/booking-form/lib/booking-form-styles";
import { formatBookingDate, formatBookingTimeRange } from "#studio/lib/bookingdatetime";

interface RescheduleBookingSummaryProps {
	addons: string[];
	date: string;
	duration: string;
	service: string;
	time: string;
}

export function RescheduleBookingSummary({
	addons,
	date,
	duration,
	service,
	time
}: RescheduleBookingSummaryProps) {
	const addonsLabel = addons.length > 0 ? addons.join(", ") : "None";
	const formattedDate = formatBookingDate(date);
	const formattedTime = formatBookingTimeRange(time, duration);

	return (
		<section>
			<h2 className={`mt-6 ${sectionHeadingClassName}`}>Existing booking</h2>
			<div className="mt-4 text-sm">
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
								{service} ({duration})
							</dd>
						</div>
						<div className="flex gap-1.5">
							<dt className="w-16 shrink-0 text-muted-foreground">Add-ons</dt>
							<dd className="font-medium">{addonsLabel}</dd>
						</div>
					</div>
				</dl>
			</div>
		</section>
	);
}
