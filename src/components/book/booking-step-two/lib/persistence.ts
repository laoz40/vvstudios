import { tick } from "svelte";
import type { PersistedBookingData } from "./form-types";
import type { BookingStepTwoState } from "./types";
import {
	readStoredBooking,
	sanitizeStoredBookingData,
	writeStoredBooking,
} from "./storage";

export function getPersistedBookingData(
	state: BookingStepTwoState,
): PersistedBookingData {
	return {
		selectedAddOns: [...state.form.selectedAddOns],
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
): void {
	const sanitizedData = sanitizeStoredBookingData(data, addOnValues);

	state.form.selectedAddOns = sanitizedData.selectedAddOns;
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
	onAfterReuse?: () => void,
): Promise<void> {
	const stored = readStoredBooking();
	if (!stored) {
		return;
	}

	applyPersistedBookingData(state, stored.data, addOnValues);
	await tick();
	onAfterReuse?.();
}

export function initializeSavedBookingState(
	state: BookingStepTwoState,
): void {
	state.hasSavedBookingData = readStoredBooking() !== null;
}
