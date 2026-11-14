import { useEffect, useReducer } from "react";
import type { DevRescheduleScenario } from "#studio/components/booking/RescheduleDevScenarioPanel";
import { useBookingCalendar } from "#studio/features/booking-form/hooks/useBookingCalendar";
import { getBookingTimeSelectionMessage } from "#studio/features/booking-form/lib/booking-form-model";
import {
	initialRescheduleSelectionState,
	reduceRescheduleSelection
} from "#studio/features/booking-form/lib/reschedule-selection-machine";
import { formatDateValue, startOfToday } from "#studio/lib/bookingdatetime";

interface UseRescheduleAvailabilityOptions {
	activeDevScenario: DevRescheduleScenario | undefined;
	duration: string;
	token: string;
}

export function useRescheduleAvailability({
	activeDevScenario,
	duration,
	token
}: UseRescheduleAvailabilityOptions) {
	const [selection, dispatch] = useReducer(
		reduceRescheduleSelection,
		initialRescheduleSelectionState
	);

	const { selectedDateValue, selectedTime } = selection;

	// Reset the selected slot when switching dev scenarios.
	useEffect(() => {
		if (activeDevScenario) {
			dispatch({ type: "dateChanged", dateValue: formatDateValue(startOfToday()) });
		}
	}, [activeDevScenario]);

	const availability = useBookingCalendar({
		source: { kind: "reschedule", token, devScenario: activeDevScenario },
		selection: {
			date: selectedDateValue,
			time: selectedTime,
			duration,
			onTimeInvalidated: () => dispatch({ type: "timeChanged", time: "" })
		}
	});

	const timeSelectionMessage = getBookingTimeSelectionMessage({
		hasDate: Boolean(selectedDateValue),
		hasDuration: true,
		isViewingSelectedMonth: availability.isViewingSelectedMonth
	});

	function handleDateChange(dateValue: string) {
		dispatch({ type: "dateChanged", dateValue });
	}

	function handleTimeChange(time: string) {
		dispatch({ type: "timeChanged", time });
	}

	return {
		availability,
		hasCompleteSelection: availability.validity.kind === "valid",
		invalidLinkMessage: availability.invalidLinkMessage,
		selectedDateValue,
		selectedTime,
		handleDateChange,
		handleTimeChange,
		timeSelectionMessage
	};
}
