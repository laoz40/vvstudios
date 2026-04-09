<script lang="ts">
	import {
		today,
		getLocalTimeZone,
		type DateValue,
	} from "@internationalized/date";
	import { onMount, tick } from "svelte";
	import { bookingStepTwoContent } from "../../content/booking";
	import BookingDetailsSection from "./booking-step-two/BookingDetailsSection.svelte";
	import ContactBillingSection from "./booking-step-two/ContactBillingSection.svelte";
	import SessionDetailsSection from "./booking-step-two/SessionDetailsSection.svelte";
	import StatusDialog from "./booking-step-two/StatusDialog.svelte";
	import SubmitSection from "./booking-step-two/SubmitSection.svelte";
	import SummaryDialog from "./booking-step-two/SummaryDialog.svelte";
	import TermsDialog from "./booking-step-two/TermsDialog.svelte";
	import {
		formatSelectedDate,
		getDateString,
		getDurationValue,
	} from "./booking-step-two/booking-date";
	import { createPricingItems } from "./booking-step-two/booking-pricing";
	import {
		createSelectedAddOnFields,
		getSelectedAddOnLabels,
		getSelectedVideoFormatLabel,
	} from "./booking-step-two/booking-selection";
	import {
		readStoredBooking,
		sanitizeStoredBookingData,
		writeStoredBooking,
	} from "./booking-step-two/booking-storage";
	import {
		createSummarySections,
		getSuccessMessage,
	} from "./booking-step-two/booking-summary";
	import type {
		BookingErrors,
		BookingField,
		BookingFormData,
		BookingSummaryData,
		PersistedBookingData,
		PricingLineItem,
		SummarySection,
	} from "./booking-step-two/booking-types";
	import {
		BookingSchema,
		getFieldErrors,
	} from "./booking-step-two/booking-validation";

	const pressableClass =
		"transform-gpu transition-[transform,border-color,background-color,color] duration-500 ease-in active:scale-99";

	const durationOptions = bookingStepTwoContent.durationOptions;
	const videoFormatOptions = bookingStepTwoContent.videoFormatOptions;
	const addOnOptions = bookingStepTwoContent.addOnOptions;
	const scriptUrl = bookingStepTwoContent.scriptUrl;
	const contactPhone = bookingStepTwoContent.contact.phone;
	const contactEmail = bookingStepTwoContent.contact.email;
	const statusMessages = bookingStepTwoContent.statusMessages;
	const termsDialogCopy = bookingStepTwoContent.termsDialog;
	const sectionCopy = bookingStepTwoContent.sections;
	const summaryCopy = bookingStepTwoContent.summary;
	const addOnValues = new Set(addOnOptions.map((option) => option.value));
	const videoFormatValues = new Set(
		videoFormatOptions.map((option) => option.value),
	);
	const minDate = today(getLocalTimeZone());

	let selectedDate: DateValue | undefined = $state(undefined);
	let selectedDuration = $state("");
	let selectedVideoFormat = $state("");
	let selectedAddOns: string[] = $state([]);
	let questionsOrRequests = $state("");
	let fullName = $state("");
	let phone = $state("");
	let accountName = $state("");
	let abn = $state("");
	let email = $state("");
	let saveBookingInfo = $state(false);
	let hasSavedBookingData = $state(false);
	let showTermsDialog = $state(false);
	let showSummaryDialog = $state(false);
	let showStatusDialog = $state(false);
	let completeBookingSection: HTMLDivElement | null = $state(null);
	let bookingDateCalendarEl: HTMLElement | null = $state(null);
	let bookingDurationGroupEl: HTMLElement | null = $state(null);
	let videoFormatGroupEl: HTMLElement | null = $state(null);
	let isSubmitting = $state(false);
	let isSubmitted = $state(false);
	let status = $state("");
	let statusType = $state<"success" | "error" | "">("");
	let wasStatusDialogOpen = $state(false);
	let errors: BookingErrors = $state({});
	let submittedSummarySections = $state<SummarySection[]>([]);
	let submittedPricingItems = $state<PricingLineItem[]>([]);

	const dateString = $derived(getDateString(selectedDate));
	const formattedDateString = $derived(formatSelectedDate(selectedDate));
	const durationValue = $derived(getDurationValue(selectedDuration));
	const selectedVideoFormatLabel = $derived(
		getSelectedVideoFormatLabel(selectedVideoFormat, videoFormatOptions),
	);
	const selectedAddOnLabels = $derived(
		getSelectedAddOnLabels(selectedAddOns, addOnOptions),
	);
	const selectedAddOnFields = $derived(
		createSelectedAddOnFields(selectedAddOns, addOnOptions),
	);
	const submitButtonLabel = $derived.by(() => {
		if (isSubmitted) return sectionCopy.submitButtonSubmitted;
		if (isSubmitting) return sectionCopy.submitButtonLoading;
		return sectionCopy.submitButtonDefault;
	});
	const statusDialogTitle = $derived(
		statusType === "success"
			? sectionCopy.statusDialogSuccessTitle
			: sectionCopy.statusDialogErrorTitle,
	);

	function getBookingFormData(): BookingFormData {
		return {
			date: dateString,
			duration: selectedDuration,
			videoFormat: selectedVideoFormat,
			questionsOrRequests,
			fullName,
			phone,
			accountName,
			abn,
			email,
		};
	}

	function getPersistedBookingData(): PersistedBookingData {
		return {
			selectedAddOns: [...selectedAddOns],
			selectedVideoFormat,
			questionsOrRequests,
			fullName,
			phone,
			accountName,
			abn,
			email,
		};
	}

	function applyPersistedBookingData(data: PersistedBookingData): void {
		const sanitizedData = sanitizeStoredBookingData(
			data,
			addOnValues,
			videoFormatValues,
		);

		selectedAddOns = sanitizedData.selectedAddOns;
		selectedVideoFormat = sanitizedData.selectedVideoFormat;
		questionsOrRequests = sanitizedData.questionsOrRequests;
		fullName = sanitizedData.fullName;
		phone = sanitizedData.phone;
		accountName = sanitizedData.accountName;
		abn = sanitizedData.abn;
		email = sanitizedData.email;
	}

	function resetFormState(): void {
		selectedDate = undefined;
		selectedDuration = "";
		selectedVideoFormat = "";
		selectedAddOns = [];
		questionsOrRequests = "";
		fullName = "";
		phone = "";
		accountName = "";
		abn = "";
		email = "";
		saveBookingInfo = false;
	}

	function openStatusDialog(type: "success" | "error", message: string): void {
		statusType = type;
		status = message;
		showStatusDialog = true;
	}

	function clearStatusState(): void {
		status = "";
		statusType = "";
	}

	function clearStatusDialog(): void {
		showStatusDialog = false;
		clearStatusState();
	}

	function clearSubmissionSummary(): void {
		submittedSummarySections = [];
		submittedPricingItems = [];
	}

	function closeSummaryDialog(): void {
		showSummaryDialog = false;
		clearStatusState();
		clearSubmissionSummary();
	}

	function createCurrentBookingSummaryData(): BookingSummaryData {
		return {
			date: formattedDateString,
			duration: selectedDuration,
			videoFormatLabel: selectedVideoFormatLabel,
			addOnLabels: [...selectedAddOnLabels],
			questionsOrRequests,
			fullName,
			phone,
			accountName,
			abn,
			email,
		};
	}

	function openSuccessSummary(data: BookingSummaryData): void {
		status = getSuccessMessage(statusMessages, data.email);
		statusType = "success";
		submittedSummarySections = createSummarySections(data, summaryCopy);
		submittedPricingItems = createPricingItems(
			selectedDuration,
			selectedAddOns,
			addOnOptions,
			summaryCopy,
		);
		showStatusDialog = false;
		showSummaryDialog = true;
	}

	function getFieldValue(field: BookingField): string {
		return getBookingFormData()[field] ?? "";
	}

	function clearFieldError(fieldName: BookingField): void {
		if (!errors[fieldName]) {
			return;
		}

		const { [fieldName]: _removed, ...rest } = errors;
		errors = rest;
	}

	function setFieldError(fieldName: BookingField, message: string): void {
		errors = {
			...errors,
			[fieldName]: message,
		};
	}

	function handleFieldBlur(event: FocusEvent): void {
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
			clearFieldError(fieldName);
			return;
		}

		setFieldError(
			fieldName,
			result.error.issues[0]?.message ??
				"Please check this field and try again.",
		);
	}

	function focusCalendarControl(): void {
		const selectedOrFirstDay = bookingDateCalendarEl?.querySelector<HTMLElement>(
			'[aria-selected="true"], button:not([disabled])',
		);
		selectedOrFirstDay?.focus();
	}

	function focusDurationField(): void {
		bookingDurationGroupEl?.scrollIntoView({
			behavior: "smooth",
			block: "center",
		});
		document
			.getElementById(`session-duration-${durationOptions[0]?.value}`)
			?.focus();
	}

	function focusVideoFormatField(): void {
		videoFormatGroupEl?.scrollIntoView({
			behavior: "smooth",
			block: "center",
		});
		document
			.getElementById(`video-format-${videoFormatOptions[0]?.value}`)
			?.focus();
	}

	function focusTextField(id: string): void {
		document.getElementById(id)?.focus();
	}

	function focusInvalidField(fieldName: BookingField): void {
		switch (fieldName) {
			case "date":
				focusCalendarControl();
				return;
			case "duration":
				focusDurationField();
				return;
			case "videoFormat":
				focusVideoFormatField();
				return;
			case "questionsOrRequests":
				focusTextField("questionsOrRequests");
				return;
			case "fullName":
				focusTextField("fullName");
				return;
			case "phone":
				focusTextField("phone");
				return;
			case "accountName":
				focusTextField("accountName");
				return;
			case "abn":
				focusTextField("abn");
				return;
			case "email":
				focusTextField("invoiceEmail");
				return;
		}
	}

	async function focusFirstValidationError(invalidField?: BookingField): Promise<void> {
		await tick();

		const firstError = document.querySelector('[role="alert"]');
		if (firstError) {
			firstError.scrollIntoView({ behavior: "smooth", block: "center" });
		}

		if (invalidField) {
			focusInvalidField(invalidField);
		}
	}

	async function validateBookingForm(): Promise<boolean> {
		const parsed = BookingSchema.safeParse(getBookingFormData());
		if (parsed.success) {
			errors = {};
			return true;
		}

		errors = getFieldErrors(parsed.error);
		await focusFirstValidationError(parsed.error.issues[0]?.path[0] as BookingField);
		return false;
	}

	function createSubmissionPayload() {
		return {
			name: fullName,
			email,
			phone,
			date: dateString,
			duration: durationValue,
			videoFormat: selectedVideoFormatLabel,
			...selectedAddOnFields,
			accountName,
			abn,
			questionsOrRequests,
		};
	}

	async function postBooking(payload: ReturnType<typeof createSubmissionPayload>) {
		return fetch(scriptUrl, {
			method: "POST",
			redirect: "follow",
			headers: {
				"Content-Type": "text/plain;charset=utf-8",
			},
			body: JSON.stringify(payload),
		});
	}

	function persistBookingDataIfNeeded(): void {
		if (!saveBookingInfo) {
			return;
		}

		writeStoredBooking(getPersistedBookingData());
		hasSavedBookingData = true;
	}

	function handleSuccessfulSubmission(summaryData: BookingSummaryData): void {
		isSubmitted = true;
		showTermsDialog = false;
		persistBookingDataIfNeeded();
		openSuccessSummary(summaryData);
		resetFormState();
	}

	function handleFailedSubmission(message: string): void {
		showTermsDialog = false;
		openStatusDialog("error", message);
	}

	async function submitBookingToAppsScript(): Promise<void> {
		if (isSubmitted || isSubmitting) {
			return;
		}

		isSubmitting = true;
		clearStatusDialog();

		const bookingSummaryData = createCurrentBookingSummaryData();
		const payload = createSubmissionPayload();

		try {
			const response = await postBooking(payload);

			console.log("Submitted booking payload:", payload);

			if (response.ok) {
				handleSuccessfulSubmission(bookingSummaryData);
				return;
			}

			handleFailedSubmission(statusMessages.submitFailed);
		} catch (error) {
			handleFailedSubmission(
				error instanceof Error
					? error.message
					: statusMessages.submitUnexpectedlyFailed,
			);
		} finally {
			isSubmitting = false;
		}
	}

	async function handleReuseLastBooking(): Promise<void> {
		const stored = readStoredBooking();
		if (!stored) {
			return;
		}

		applyPersistedBookingData(stored.data);
		await tick();
		completeBookingSection?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
	}

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();

		if (isSubmitted || isSubmitting) {
			return;
		}

		if (!scriptUrl) {
			openStatusDialog("error", statusMessages.missingScriptUrl);
			return;
		}

		if (!(await validateBookingForm())) {
			return;
		}

		clearStatusDialog();
		showTermsDialog = true;
	}

	async function handleConfirmTerms(): Promise<void> {
		await submitBookingToAppsScript();
	}

	function loadSavedBookingAvailability(): void {
		hasSavedBookingData = readStoredBooking() !== null;
	}

	$effect(() => {
		if (wasStatusDialogOpen && !showStatusDialog) {
			clearStatusState();
		}

		wasStatusDialogOpen = showStatusDialog;
	});

	onMount(() => {
		loadSavedBookingAvailability();
	});
</script>

<div class="mx-auto w-full max-w-4xl space-y-8">
	<div
		class="sr-only"
		role="status"
		aria-live="polite"
		aria-atomic="true">
		{status}
	</div>

	<form
		class="space-y-10 md:space-y-14"
		onsubmit={handleSubmit}>
		<BookingDetailsSection
			{sectionCopy}
			{durationOptions}
			{errors}
			{minDate}
			{pressableClass}
			bind:selectedDate
			bind:selectedDuration
			bind:bookingDateCalendarEl
			bind:bookingDurationGroupEl />

		<SessionDetailsSection
			{sectionCopy}
			{addOnOptions}
			{videoFormatOptions}
			{contactPhone}
			{contactEmail}
			{hasSavedBookingData}
			{pressableClass}
			{errors}
			bind:selectedAddOns
			bind:selectedVideoFormat
			bind:questionsOrRequests
			bind:videoFormatGroupEl
			onReuseLastBooking={handleReuseLastBooking}
			onFieldBlur={handleFieldBlur} />

		<ContactBillingSection
			{sectionCopy}
			{errors}
			bind:fullName
			bind:phone
			bind:accountName
			bind:abn
			bind:email
			onFieldBlur={handleFieldBlur} />

		<SubmitSection
			{sectionCopy}
			{pressableClass}
			{submitButtonLabel}
			{isSubmitting}
			{isSubmitted}
			bind:saveBookingInfo
			bind:completeBookingSection />
	</form>
</div>

<TermsDialog
	bind:open={showTermsDialog}
	{isSubmitting}
	{isSubmitted}
	{termsDialogCopy}
	submitButtonLoading={sectionCopy.submitButtonLoading}
	onConfirm={handleConfirmTerms} />

<SummaryDialog
	bind:open={showSummaryDialog}
	{isSubmitting}
	{status}
	{sectionCopy}
	{summaryCopy}
	{submittedSummarySections}
	{submittedPricingItems}
	onClose={closeSummaryDialog} />

<StatusDialog
	bind:open={showStatusDialog}
	title={statusDialogTitle}
	{status}
	dismissLabel={sectionCopy.statusDialogDismissButton}
	onClose={clearStatusDialog} />
