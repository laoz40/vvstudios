import { tick } from "svelte";
import type { PersistedBookingData } from "./lib/form-types";
import type { BookingStepTwoState } from "./lib/types";
import {
	readStoredBooking,
	sanitizeStoredBookingData,
	writeStoredBooking,
} from "./lib/storage";

export function getPersistedBookingData(
	state: BookingStepTwoState,
): PersistedBookingData {
	return {
		selectedAddOns: [...state.form.selectedAddOns],
		selectedVideoFormat: state.form.selectedVideoFormat,
		questionsOrRequests: state.form.questionsOrRequests,
		fullName: state.form.fullName,
		phone: state.form.phone,
		accountName: state.form.accountName,
		abn: state.form.abn,
		email: state.form.email,
	};
}

export function applyPersistedBookingData(
	state: BookingStepTwoState,
	data: PersistedBookingData,
	addOnValues: Set<string>,
	videoFormatValues: Set<string>,
): void {
	const sanitizedData = sanitizeStoredBookingData(
		data,
		addOnValues,
		videoFormatValues,
	);

	state.form.selectedAddOns = sanitizedData.selectedAddOns;
	state.form.selectedVideoFormat = sanitizedData.selectedVideoFormat;
	state.form.questionsOrRequests = sanitizedData.questionsOrRequests;
	state.form.fullName = sanitizedData.fullName;
	state.form.phone = sanitizedData.phone;
	state.form.accountName = sanitizedData.accountName;
	state.form.abn = sanitizedData.abn;
	state.form.email = sanitizedData.email;
}

export function persistBookingDataIfNeeded(
	state: BookingStepTwoState,
): void {
	if (!state.form.saveBookingInfo) {
		return;
	}

	writeStoredBooking(getPersistedBookingData(state));
	state.hasSavedBookingData = true;
}

export async function reuseLastBooking(
	state: BookingStepTwoState,
	addOnValues: Set<string>,
	videoFormatValues: Set<string>,
	onAfterReuse?: () => void,
): Promise<void> {
	const stored = readStoredBooking();
	if (!stored) {
		return;
	}

	applyPersistedBookingData(
		state,
		stored.data,
		addOnValues,
		videoFormatValues,
	);
	await tick();
	onAfterReuse?.();
}

export function initializeSavedBookingState(
	state: BookingStepTwoState,
): void {
	state.hasSavedBookingData = readStoredBooking() !== null;
}
