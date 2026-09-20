import CheckedIcon from "#/components/ui/checked-icon";
import {
	BookingDetails,
	type BookingDetailsData
} from "#studio/features/booking-complete/components/BookingDetails";

export interface RescheduleConfirmationProps {
	booking: BookingDetailsData;
}

export function RescheduleConfirmation({ booking }: RescheduleConfirmationProps) {
	return (
		<section className="flex flex-col gap-8">
			<div className="space-y-4">
				<h1 className="font-brand text-2xl leading-tight font-semibold uppercase sm:text-3xl md:text-5xl">
					<CheckedIcon
						className="mr-3 inline size-7 -translate-y-1 text-primary sm:size-8 md:size-9"
						aria-hidden="true"
						focusable="false"
					/>
					Booking updated
				</h1>
				<p className="max-w-2xl text-base leading-normal text-muted-foreground">
					Your booking has been rescheduled. Please check your email for the updated details.
				</p>
			</div>

			<BookingDetails booking={booking} />
		</section>
	);
}
