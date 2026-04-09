import type { BookingStepTwoState } from "./booking-store-types";

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
