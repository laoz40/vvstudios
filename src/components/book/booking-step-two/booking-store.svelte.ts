import { formatSelectedDate, getDateString, getDurationValue } from "./booking-date";
import { getSelectedAddOnLabels, getSelectedVideoFormatLabel } from "./booking-selection-mappers";
import type {
  BookingStepTwoDerived,
  BookingStepTwoStore,
  BookingStepTwoUi,
  CreateBookingStoreOptions,
} from "./booking-store-types";
import type { BookingField, BookingFormData } from "./booking-types";
import {
  clearBookingStatusState,
  clearBookingSubmissionSummary,
  createBookingState,
  openBookingStatus,
  resetBookingFormState,
} from "./create-booking-state.svelte";
import {
  initializeSavedBookingState,
  persistBookingDataIfNeeded,
  reuseLastBooking as restoreLastBooking,
} from "./persist-booking";
import {
  createCurrentBookingSummaryData,
  createSubmissionPayload,
  openBookingSuccessSummary,
  postBooking,
} from "./submit-booking";
import { handleBookingFieldBlur, validateBookingForm } from "./validate-booking";

export const BOOKING_STEP_TWO_CONTEXT = Symbol("booking-step-two");

export type {
  BookingStepTwoActions,
  BookingStepTwoContext,
  BookingStepTwoDerived,
  BookingStepTwoState,
  BookingStepTwoStore,
  BookingStepTwoUi,
  CreateBookingStoreOptions,
} from "./booking-store-types";

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
  const fieldFocusHandlers = new Map<BookingField, () => void>();
  let reuseTargetHandler: (() => void) | null = null;

  const state = createBookingState();

  // computed values used by the booking ui
  const derived = {
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

  function getBookingFormData(): BookingFormData {
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

  // focus the first invalid field when validation fails
  function focusFirstValidationError(field?: BookingField): void {
    if (!field) {
      return;
    }

    fieldFocusHandlers.get(field)?.();
  }

  // validate a field when it loses focus
  function handleFieldBlur(event: FocusEvent): void {
    handleBookingFieldBlur(state, event, (field) => getBookingFormData()[field] ?? "");
  }

  // run checks before the form is submitted
  async function requestSubmit(): Promise<boolean> {
    if (state.isSubmitted || state.isSubmitting) {
      return false;
    }

    if (!content.scriptUrl) {
      openBookingStatus(state, "error", content.statusMessages.missingScriptUrl);
      return false;
    }

    clearBookingStatusState(state);
    return validateBookingForm(state, getBookingFormData, focusFirstValidationError);
  }

  // save the success state and reset the form
  function handleSuccessfulSubmission(): void {
    const bookingSummaryData = createCurrentBookingSummaryData(state, derived);

    state.isSubmitted = true;
    persistBookingDataIfNeeded(state);
    openBookingSuccessSummary(state, bookingSummaryData, content.statusMessages, ui);
    resetBookingFormState(state);
  }

  // show an error message after a failed submit
  function handleFailedSubmission(message: string): void {
    openBookingStatus(state, "error", message);
  }

  // send the booking payload to the server script
  async function submitBooking(): Promise<boolean> {
    if (state.isSubmitted || state.isSubmitting) {
      return false;
    }

    state.isSubmitting = true;
    clearBookingStatusState(state);

    const payload = createSubmissionPayload(state, derived, ui);

    try {
      const response = await postBooking(content.scriptUrl, payload);

      console.log("Submitted booking payload:", payload);

      if (response.ok) {
        handleSuccessfulSubmission();
        return true;
      }

      handleFailedSubmission(content.statusMessages.submitFailed);
      return false;
    } catch (error) {
      handleFailedSubmission(
        error instanceof Error ? error.message : content.statusMessages.submitUnexpectedlyFailed,
      );
      return false;
    } finally {
      state.isSubmitting = false;
    }
  }

  // store a focus handler for a form field
  function registerFieldFocus(field: BookingField, handler: () => void): () => void {
    fieldFocusHandlers.set(field, handler);
    return () => {
      if (fieldFocusHandlers.get(field) === handler) {
        fieldFocusHandlers.delete(field);
      }
    };
  }

  // store the handler used to jump back to the booking form
  function registerReuseTarget(handler: () => void): () => void {
    reuseTargetHandler = handler;
    return () => {
      if (reuseTargetHandler === handler) {
        reuseTargetHandler = null;
      }
    };
  }

  return {
    state,
    derived,
    ui,
    actions: {
      initialize(): void {
        initializeSavedBookingState(state);
      },
      handleFieldBlur,
      toggleAddOn(value: string, checked: boolean): void {
        state.form.selectedAddOns = checked
          ? [...state.form.selectedAddOns, value]
          : state.form.selectedAddOns.filter((item) => item !== value);
      },
      reuseLastBooking(): Promise<void> {
        return restoreLastBooking(
          state,
          addOnValues,
          videoFormatValues,
          reuseTargetHandler ?? undefined,
        );
      },
      requestSubmit,
      submitBooking,
      clearStatusState(): void {
        clearBookingStatusState(state);
      },
      closeSummary(): void {
        clearBookingStatusState(state);
        clearBookingSubmissionSummary(state);
      },
      registerFieldFocus,
      registerReuseTarget,
    },
  };
}
