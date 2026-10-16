interface RescheduleSelectionState {
	selectedDateValue: string;
	selectedTime: string;
}

type RescheduleSelectionEvent =
	| { type: "dateChanged"; dateValue: string }
	| { type: "timeChanged"; time: string };

export const initialRescheduleSelectionState: RescheduleSelectionState = {
	selectedDateValue: "",
	selectedTime: ""
};

export function reduceRescheduleSelection(
	state: RescheduleSelectionState,
	event: RescheduleSelectionEvent
): RescheduleSelectionState {
	switch (event.type) {
		case "dateChanged":
			return { selectedDateValue: event.dateValue, selectedTime: "" };
		case "timeChanged":
			return { ...state, selectedTime: event.time };
		default: {
			const exhaustive: never = event;

			return exhaustive;
		}
	}
}
