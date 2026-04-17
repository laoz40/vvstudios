import type { BookingStepTwoContent } from "../../../../content/bookingTypes";
import type {
	BookingSummaryData,
	SummaryItem,
	SummarySection,
} from "./form-types";

export function createSummarySections(
	data: BookingSummaryData,
	summaryCopy: BookingStepTwoContent["summary"],
): SummarySection[] {
	const sessionItems: SummaryItem[] = [
		{
			label: summaryCopy.labels.date,
			value: data.date || summaryCopy.emptyValue,
		},
		{
			label: summaryCopy.labels.duration,
			value: data.duration || summaryCopy.emptyValue,
		},
	];

	if (data.questionsOrRequests.trim()) {
		sessionItems.push({
			label: summaryCopy.labels.questions,
			value: data.questionsOrRequests,
		});
	}

	return [
		{
			title: summaryCopy.sessionDetailsTitle,
			items: sessionItems,
		},
	];
}

export function getSuccessMessage(
	statusMessages: BookingStepTwoContent["statusMessages"],
	invoiceEmail: string,
): string {
	return statusMessages.success.replace("{email}", invoiceEmail);
}
