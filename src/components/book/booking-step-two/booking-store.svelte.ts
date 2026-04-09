import { createBookingDerived, createBookingState } from "./lib/state.svelte";
import type { BookingField } from "./lib/form-types";
import {
	clearBookingStatusState,
	clearBookingSubmissionSummary,
	openBookingStatus,
	resetBookingFormState,
} from "./lib/state.svelte";
import {
	initializeSavedBookingState,
	persistBookingDataIfNeeded,
	reuseLastBooking as restoreLastBooking,
} from "./lib/persistence";
import {
	createCurrentBookingSummaryData,
	createSubmissionPayload,
	openBookingSuccessSummary,
	postBooking,
} from "./lib/submission";
import { handleBookingFieldBlur, validateBookingForm } from "./lib/validation";
import type { BookingStepTwoDerived, BookingStepTwoStore, BookingStepTwoUi, CreateBookingStoreOptions } from "./lib/types";

export const BOOKING_STEP_TWO_CONTEXT = Symbol("booking-step-two");

export type {
	BookingStepTwoActions,
	BookingStepTwoContext,
	BookingStepTwoDerived,
	BookingStepTwoState,
	BookingStepTwoStore,
	BookingStepTwoUi,
	CreateBookingStoreOptions,
} from "./lib/types";

type BookingActions = BookingStepTwoStore["actions"];

type BookingFormData = {
	date: string;
	duration: string;
	videoFormat: string;
	questionsOrRequests: string;
	fullName: string;
	phone: string;
	accountName: string;
	abn: string;
	email: string;
};

function createBookingFormData(state: BookingStepTwoStore["state"], derived: BookingStepTwoDerived): BookingFormData {
	return {
		date: derived.dateString,
		duration: state.form.selectedDuration,
		videoFormat: state.form.selectedVideoFormat,
		questionsOrRequests: state.form.questionsOrRequests,
		fullName: state.form.fullName,
		phone: state.form.phone,
		accountName: state.form.accountName,
		abn: state.form.abn,
		email: state.form.email,
	};
}

export function createBookingStore({
	content,
	pressableClass,
	minDate,
}: CreateBookingStoreOptions): BookingStepTwoStore {
	const ui: BookingStepTwoUi = {
		sectionCopy: content.sections,
		summaryCopy: content.summary,
		termsDialogCopy: content.termsDialog,
		durationOptions: content.durationOptions,
		videoFormatOptions: content.videoFormatOptions,
		addOnOptions: content.addOnOptions,
		contactPhone: content.contact.phone,
		contactEmail: content.contact.email,
		pressableClass,
		minDate,
	};

	const addOnValues = new Set(ui.addOnOptions.map((option) => option.value));
	const videoFormatValues = new Set(ui.videoFormatOptions.map((option) => option.value));
	const state = createBookingState();
	const derived = createBookingDerived(state, ui);
	const fieldFocusHandlers = new Map<BookingField, () => void>();
	let reuseTargetHandler: (() => void) | null = null;

	function focusFirstValidationError(field?: BookingField): void {
		fieldFocusHandlers.get(field)?.();
	}

	function handleFieldBlur(event: FocusEvent): void {
		const bookingFormData = createBookingFormData(state, derived);
		handleBookingFieldBlur(state, event, (field) => bookingFormData[field] ?? "");
	}

	async function validateBeforeSubmit(): Promise<boolean> {
		if (state.isSubmitted || state.isSubmitting) return false;
		if (!content.scriptUrl) {
			openBookingStatus(state, "error", content.statusMessages.missingScriptUrl);
			return false;
		}

		clearBookingStatusState(state);
		return validateBookingForm(state, () => createBookingFormData(state, derived), focusFirstValidationError);
	}

	function registerFieldFocus(field: BookingField, handler: () => void): () => void {
		fieldFocusHandlers.set(field, handler);
		return () => {
			if (fieldFocusHandlers.get(field) === handler) fieldFocusHandlers.delete(field);
		};
	}

	async function sendBooking(): Promise<boolean> {
		if (state.isSubmitted || state.isSubmitting) return false;
		state.isSubmitting = true;
		clearBookingStatusState(state);

		const payload = createSubmissionPayload(state, derived, ui);
		try {
			const response = await postBooking(content.scriptUrl, payload);
			console.log("Submitted booking payload:", payload);
			if (!response.ok) {
				openBookingStatus(state, "error", content.statusMessages.submitFailed);
				return false;
			}

			const bookingSummaryData = createCurrentBookingSummaryData(state, derived);
			state.isSubmitted = true;
			persistBookingDataIfNeeded(state);
			openBookingSuccessSummary(state, bookingSummaryData, content.statusMessages, ui);
			resetBookingFormState(state);
			return true;
		} catch (error) {
			openBookingStatus(
				state,
				"error",
				error instanceof Error ? error.message : content.statusMessages.submitUnexpectedlyFailed,
			);
			return false;
		} finally {
			state.isSubmitting = false;
		}
	}

	function initialize(): void {
		initializeSavedBookingState(state);
	}

	function toggleAddOn(value: string, checked: boolean): void {
		state.form.selectedAddOns = checked
			? [...state.form.selectedAddOns, value]
			: state.form.selectedAddOns.filter((selectedValue: string) => selectedValue !== value);
	}

	function restoreSavedBooking(): Promise<void> {
		return restoreLastBooking(state, addOnValues, videoFormatValues, reuseTargetHandler ?? undefined);
	}

	function clearBookingStatus(): void {
		clearBookingStatusState(state);
	}

	function closeSuccessSummary(): void {
		clearBookingStatusState(state);
		clearBookingSubmissionSummary(state);
	}

	function registerReturnToFormHandler(handler: () => void): () => void {
		reuseTargetHandler = handler;
		return () => {
			if (reuseTargetHandler === handler) reuseTargetHandler = null;
		};
	}

	const actions: BookingActions = {
		initialize,
		handleFieldBlur,
		toggleAddOn,
		reuseLastBooking: restoreSavedBooking,
		requestSubmit: validateBeforeSubmit,
		submitBooking: sendBooking,
		clearStatusState: clearBookingStatus,
		closeSummary: closeSuccessSummary,
		registerFieldFocus,
		registerReuseTarget: registerReturnToFormHandler,
	};

	return {
		state,
		derived,
		ui,
		actions,
	};
}
