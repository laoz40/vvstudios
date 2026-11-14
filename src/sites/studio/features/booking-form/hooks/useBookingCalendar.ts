import { useEffect, useReducer } from "react";
import { useBookingCalendarData } from "#studio/features/booking-form/hooks/useBookingCalendarData";
import {
	createAvailabilityCalendar,
	getAvailabilityPicker,
	reduceAvailabilityCalendar,
	type CalendarSelection
} from "#studio/features/booking-form/lib/availability-picker-machine";
import {
	overrideCalendarError,
	type BookingCalendarSource
} from "#studio/features/booking-form/lib/booking-calendar-source";
import { getCurrentTimestamp } from "#studio/lib/bookingdatetime";

export type AvailabilityPickerState = Omit<ReturnType<typeof getAvailabilityPicker>, "validity"> & {
	calendarMonth: Date;
	setCalendarMonth: (date: Date) => void;
};

export function useBookingCalendar({
	source,
	selection
}: {
	source: BookingCalendarSource;
	selection: CalendarSelection & { onTimeInvalidated: () => void };
}) {
	const [state, dispatch] = useReducer(reduceAvailabilityCalendar, undefined, () =>
		createAvailabilityCalendar(getCurrentTimestamp())
	);

	const data = useBookingCalendarData({ source, currentTimestamp: state.currentTimestamp });

	useEffect(() => {
		const interval = window.setInterval(() => {
			dispatch({ type: "clockAdvanced", timestamp: getCurrentTimestamp() });
		}, 60_000);

		return () => window.clearInterval(interval);
	}, []);

	const availability = overrideCalendarError({
		availability: data.availability,
		message: source.kind === "booking" ? state.errorOverride : ""
	});

	const picker = getAvailabilityPicker({
		availability,
		calendar: { month: state.month, dateRange: data.dateRange },
		selection
	});

	const { date, time, onTimeInvalidated } = selection;

	// The form owns the selection. Availability and clock changes can invalidate it.
	useEffect(() => {
		if (picker.validity.kind === "invalid") {
			onTimeInvalidated();
		}
	}, [date, time, onTimeInvalidated, picker.validity.kind]);

	return {
		...picker,
		calendarMonth: state.month,
		invalidLinkMessage: availability.kind === "invalidLink" ? availability.content : null,
		setAvailabilityError: (message: string) => dispatch({ type: "errorOverrideChanged", message }),
		setCalendarMonth: (month: Date) => dispatch({ type: "monthChanged", month })
	};
}
