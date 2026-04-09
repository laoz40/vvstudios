import { tick } from "svelte";
import type { BookingField, BookingFormData } from "./booking-types";
import type { BookingStepTwoState } from "./booking-store-types";
import {
	BookingSchema,
	getFieldErrors,
} from "./zod";

export function clearBookingFieldError(
	state: BookingStepTwoState,
	fieldName: BookingField,
): void {
	if (!state.errors[fieldName]) {
		return;
	}

	const { [fieldName]: _removed, ...rest } = state.errors;
	state.errors = rest;
}

export function setBookingFieldError(
	state: BookingStepTwoState,
	fieldName: BookingField,
	message: string,
): void {
	state.errors = {
		...state.errors,
		[fieldName]: message,
	};
}

export function handleBookingFieldBlur(
	state: BookingStepTwoState,
	event: FocusEvent,
	getFieldValue: (field: BookingField) => string,
): void {
	const target = event.currentTarget as
		| HTMLInputElement
		| HTMLTextAreaElement
		| null;
	if (!target?.name) {
		return;
	}

	const fieldName = target.name as BookingField;
	if (!(fieldName in BookingSchema.shape)) {
		return;
	}

	const fieldSchema = BookingSchema.shape[fieldName];
	const result = fieldSchema.safeParse(getFieldValue(fieldName));

	if (result.success) {
		clearBookingFieldError(state, fieldName);
		return;
	}

	setBookingFieldError(
		state,
		fieldName,
		result.error.issues[0]?.message ??
			"Please check this field and try again.",
	);
}

export async function validateBookingForm(
	state: BookingStepTwoState,
	getBookingFormData: () => BookingFormData,
	focusField: (field?: BookingField) => void,
): Promise<boolean> {
	const parsed = BookingSchema.safeParse(getBookingFormData());
	if (parsed.success) {
		state.errors = {};
		return true;
	}

	state.errors = getFieldErrors(parsed.error);
	await tick();

	const firstError = document.querySelector('[role="alert"]');
	if (firstError) {
		firstError.scrollIntoView({ behavior: "smooth", block: "center" });
	}

	focusField(parsed.error.issues[0]?.path[0] as BookingField | undefined);
	return false;
}
