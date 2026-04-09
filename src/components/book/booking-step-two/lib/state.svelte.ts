import { formatSelectedDate, getDateString, getDurationValue } from "./date";
import { getSelectedAddOnLabels, getSelectedVideoFormatLabel } from "./selection-mappers";
import type {
	BookingStepTwoDerived,
	BookingStepTwoState,
	BookingStepTwoUi,
} from "./types";

class BookingState implements BookingStepTwoState {
	form = $state({
		selectedDate: undefined,
		selectedDuration: "",
		selectedVideoFormat: "",
		selectedAddOns: [],
		questionsOrRequests: "",
		fullName: "",
		phone: "",
		accountName: "",
		abn: "",
		email: "",
		saveBookingInfo: false,
	});
	hasSavedBookingData = $state(false);
	isSubmitting = $state(false);
	isSubmitted = $state(false);
	status = $state("");
	statusType = $state<"success" | "error" | "">("");
	errors = $state({});
	submittedSummarySections = $state([]);
	submittedPricingItems = $state([]);
}

export function createBookingState(): BookingStepTwoState {
	return new BookingState();
}

export function createBookingDerived(
	state: BookingStepTwoState,
	ui: BookingStepTwoUi,
): BookingStepTwoDerived {
	return {
		get dateString() {
			return getDateString(state.form.selectedDate);
		},
		get formattedDateString() {
			return formatSelectedDate(state.form.selectedDate);
		},
		get durationValue() {
			return getDurationValue(state.form.selectedDuration);
		},
		get selectedVideoFormatLabel() {
			return getSelectedVideoFormatLabel(state.form.selectedVideoFormat, ui.videoFormatOptions);
		},
		get selectedAddOnLabels() {
			return getSelectedAddOnLabels(state.form.selectedAddOns, ui.addOnOptions);
		},
		get submitButtonLabel() {
			if (state.isSubmitted) return ui.sectionCopy.submitButtonSubmitted;
			if (state.isSubmitting) return ui.sectionCopy.submitButtonLoading;
			return ui.sectionCopy.submitButtonDefault;
		},
		get statusDialogTitle() {
			return state.statusType === "success"
				? ui.sectionCopy.statusDialogSuccessTitle
				: ui.sectionCopy.statusDialogErrorTitle;
		},
	} satisfies BookingStepTwoDerived;
}

export function resetBookingFormState(state: BookingStepTwoState): void {
	state.form.selectedDate = undefined;
	state.form.selectedDuration = "";
	state.form.selectedVideoFormat = "";
	state.form.selectedAddOns = [];
	state.form.questionsOrRequests = "";
	state.form.fullName = "";
	state.form.phone = "";
	state.form.accountName = "";
	state.form.abn = "";
	state.form.email = "";
	state.form.saveBookingInfo = false;
	state.errors = {};
}

export function openBookingStatus(
	state: BookingStepTwoState,
	type: "success" | "error",
	message: string,
): void {
	state.statusType = type;
	state.status = message;
}

export function clearBookingStatusState(state: BookingStepTwoState): void {
	state.status = "";
	state.statusType = "";
}

export function clearBookingSubmissionSummary(
	state: BookingStepTwoState,
): void {
	state.submittedSummarySections = [];
	state.submittedPricingItems = [];
}
