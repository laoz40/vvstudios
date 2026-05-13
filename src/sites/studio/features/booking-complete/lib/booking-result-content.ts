import type { BookingStatus } from "#studio/components/booking/BookingCompleteDevScenarioPanel";

export interface BookingResultContent {
	description: string;
	isBookingCompletionFailure: boolean;
	title: string;
}

export function getBookingResultContent(booking: BookingStatus): BookingResultContent {
	switch (booking.status) {
		case "failed": {
			switch (booking.bookingFailureCode) {
				case "BOOKING_TIME_UNAVAILABLE":
					return {
						title: "We received your payment and need to adjust your booking time",
						description:
							"This time slot became unavailable while checkout was finishing. Please contact us and we’ll help move your booking to a time that works for you.",
						isBookingCompletionFailure: true,
					};

				case "GOOGLE_CALENDAR_CREATE_FAILED":
					return {
						title: "We received your payment and need to confirm your booking manually",
						description:
							"Your payment went through, but the calendar event could not be created automatically. Please contact us and we’ll finalise the booking for you.",
						isBookingCompletionFailure: true,
					};

				default:
					return {
						title: "We received your payment and need to confirm your booking manually",
						description:
							"Your payment went through, but the booking could not be completed automatically. Please contact us and we’ll finalise it for you.",
						isBookingCompletionFailure: true,
					};
			}
		}

		case "confirmed":
			return {
				title: "Congrats, your booking is confirmed!",
				description: "Your invoice has been emailed to you, or you can download it",
				isBookingCompletionFailure: false,
			};

		case "pending_payment":
			return {
				title: "Processing booking",
				description: "We’re still checking your payment.",
				isBookingCompletionFailure: false,
			};

		case "expired":
			return {
				title: "This booking session has expired",
				description: "Please return to the booking form to start a new checkout session.",
				isBookingCompletionFailure: false,
			};

		default:
			throw new Error(`Unhandled booking status: ${booking.status}`);
	}
}
