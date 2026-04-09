<script lang="ts">
	import { today, getLocalTimeZone } from "@internationalized/date";
	import { onMount, setContext } from "svelte";
	import { bookingStepTwoContent } from "../../content/booking";
	import BookingDetailsSection from "./booking-step-two/components/BookingDetailsSection.svelte";
	import ContactBillingSection from "./booking-step-two/components/ContactBillingSection.svelte";
	import SessionDetailsSection from "./booking-step-two/components/SessionDetailsSection.svelte";
	import StatusDialog from "./booking-step-two/components/StatusDialog.svelte";
	import SubmitSection from "./booking-step-two/components/SubmitSection.svelte";
	import SummaryDialog from "./booking-step-two/components/SummaryDialog.svelte";
	import TermsDialog from "./booking-step-two/components/TermsDialog.svelte";
	import {
		BOOKING_STEP_TWO_CONTEXT,
		createBookingStore,
	} from "./booking-step-two/booking-store.svelte";

	const pressableClass =
		"transform-gpu transition-[transform,border-color,background-color,color] duration-500 ease-in active:scale-99";
	const minDate = today(getLocalTimeZone());

	const booking = createBookingStore({
		content: bookingStepTwoContent,
		pressableClass,
		minDate,
	});

	setContext(BOOKING_STEP_TWO_CONTEXT, booking);

	let showTermsDialog = $state(false);
	let showSummaryDialog = $state(false);
	let showStatusDialog = $state(false);
	let wasSummaryDialogOpen = $state(false);
	let wasStatusDialogOpen = $state(false);

	const termsDialogProps = $derived.by(() => ({
		isSubmitting: booking.state.isSubmitting,
		isSubmitted: booking.state.isSubmitted,
		termsDialogCopy: booking.ui.termsDialogCopy,
		submitButtonLoading: booking.ui.sectionCopy.submitButtonLoading,
	}));

	const summaryDialogProps = $derived.by(() => ({
		isSubmitting: booking.state.isSubmitting,
		status: booking.state.status,
		sectionCopy: booking.ui.sectionCopy,
		summaryCopy: booking.ui.summaryCopy,
		submittedSummarySections: booking.state.submittedSummarySections,
		submittedPricingItems: booking.state.submittedPricingItems,
	}));


	const statusDialogProps = $derived.by(() => ({
		title: booking.derived.statusDialogTitle,
		status: booking.state.status,
		dismissLabel: booking.ui.sectionCopy.statusDialogDismissButton,
	}));

	async function handleSubmit(event: SubmitEvent): Promise<void> {
		event.preventDefault();

		const canProceed = await booking.actions.requestSubmit();
		if (canProceed) {
			showStatusDialog = false;
			showTermsDialog = true;
			return;
		}

		if (booking.state.statusType === "error") {
			showStatusDialog = true;
		}
	}

	async function handleConfirmTerms(): Promise<void> {
		const wasSuccessful = await booking.actions.submitBooking();
		showTermsDialog = false;

		if (wasSuccessful) {
			showStatusDialog = false;
			showSummaryDialog = true;
			return;
		}

		if (booking.state.statusType === "error") {
			showStatusDialog = true;
		}
	}

	function handleSummaryDialogClose(): void {
		showSummaryDialog = false;
		booking.actions.closeSummary();
	}

	function handleStatusDialogClose(): void {
		showStatusDialog = false;
		booking.actions.clearStatusState();
	}

	$effect(() => {
		if (wasSummaryDialogOpen && !showSummaryDialog) {
			booking.actions.closeSummary();
		}

		wasSummaryDialogOpen = showSummaryDialog;
	});

	$effect(() => {
		if (wasStatusDialogOpen && !showStatusDialog) {
			booking.actions.clearStatusState();
		}

		wasStatusDialogOpen = showStatusDialog;
	});

	onMount(() => {
		booking.actions.initialize();
	});
</script>

<div class="mx-auto w-full max-w-4xl space-y-8">
	<div
		class="sr-only"
		role="status"
		aria-live="polite"
		aria-atomic="true">
		{booking.state.status}
	</div>

	<form
		class="space-y-10 md:space-y-14"
		onsubmit={handleSubmit}>
		<BookingDetailsSection />
		<SessionDetailsSection />
		<ContactBillingSection />
		<SubmitSection />
	</form>
</div>

<TermsDialog
	bind:open={showTermsDialog}
	{...termsDialogProps}
	onConfirm={handleConfirmTerms} />

<SummaryDialog
	bind:open={showSummaryDialog}
	{...summaryDialogProps}
	onClose={handleSummaryDialogClose} />

<StatusDialog
	bind:open={showStatusDialog}
	{...statusDialogProps}
	onClose={handleStatusDialogClose} />
