import type { BookingStepTwoContent } from "../../../../content/bookingTypes";
import { createPricingItems } from "./calculate-pricing";
import { mapAllAddOnsToBooleanSelectionState } from "./selection-mappers";
import { createSummarySections, getSuccessMessage } from "./summary";
import type { BookingSummaryData } from "./form-types";
import type {
	BookingStepTwoDerived,
	BookingStepTwoState,
	BookingStepTwoUi,
} from "./types";

type BookingStatusMessages = BookingStepTwoContent["statusMessages"];

export function createCurrentBookingSummaryData(
	state: BookingStepTwoState,
	derived: BookingStepTwoDerived,
): BookingSummaryData {
	return {
		date: derived.formattedDateString,
		duration: state.form.selectedDuration,
		addOnLabels: [...derived.selectedAddOnLabels],
		questionsOrRequests: state.form.questionsOrRequests,
		fullName: state.form.fullName,
		phone: state.form.phone,
		accountName: state.form.accountName,
		abn: state.form.abn,
		email: state.form.email,
	};
}

export function openBookingSuccessSummary(
	state: BookingStepTwoState,
	data: BookingSummaryData,
	statusMessages: BookingStatusMessages,
	ui: BookingStepTwoUi,
): void {
	state.status = getSuccessMessage(statusMessages, data.email);
	state.statusType = "success";
	state.submittedSummarySections = createSummarySections(data, ui.summaryCopy);
	state.submittedPricingItems = createPricingItems(
		state.form.selectedDuration,
		state.form.selectedAddOns,
		ui.addOnOptions,
		ui.summaryCopy,
	);
}

export function createSubmissionPayload(
	state: BookingStepTwoState,
	derived: BookingStepTwoDerived,
	ui: BookingStepTwoUi,
) {
	return {
		name: state.form.fullName,
		email: state.form.email,
		phone: state.form.phone,
		date: derived.dateString,
		duration: derived.durationValue,
		...mapAllAddOnsToBooleanSelectionState(state.form.selectedAddOns, ui.addOnOptions),
		accountName: state.form.accountName,
		abn: state.form.abn,
		questionsOrRequests: state.form.questionsOrRequests,
	};
}

export async function postBooking(
	scriptUrl: string,
	payload: ReturnType<typeof createSubmissionPayload>,
): Promise<Response> {
	return fetch(scriptUrl, {
		method: "POST",
		redirect: "follow",
		headers: {
			"Content-Type": "text/plain;charset=utf-8",
		},
		body: JSON.stringify(payload),
	});
}
