<script lang="ts">
	import { getContext, onMount } from "svelte";
	import { Button } from "$lib/components/ui/button";
	import { Checkbox } from "$lib/components/ui/checkbox";
	import { Label } from "$lib/components/ui/label";
	import { cn } from "$lib/utils.js";
	import {
		BOOKING_STEP_TWO_CONTEXT,
		type BookingStepTwoContext,
	} from "../booking-store.svelte";

	const booking = getContext<BookingStepTwoContext>(BOOKING_STEP_TWO_CONTEXT);
	const { state: bookingState, derived, ui, actions } = booking;

	let completeBookingSection: HTMLDivElement | null = $state(null);

	onMount(() => {
		return actions.registerReuseTarget(() => {
			completeBookingSection?.scrollIntoView({
				behavior: "smooth",
				block: "start",
			});
		});
	});
</script>

<div
	class="space-y-6"
	bind:this={completeBookingSection}>
	<div class="flex items-center gap-3">
		<Checkbox
			id="saveBookingInfo"
			bind:checked={bookingState.form.saveBookingInfo}
			class="rounded-sm" />
		<Label
			for="saveBookingInfo"
			class="text-muted-foreground cursor-pointer text-sm leading-relaxed">
			{ui.sectionCopy.saveBookingInfoLabel}
		</Label>
	</div>

	<Button
		type="submit"
		size="lg"
		class={cn(
			"h-12 w-full rounded-lg text-base font-bold tracking-wider",
			ui.pressableClass,
		)}
		disabled={bookingState.isSubmitting || bookingState.isSubmitted}>
		{derived.submitButtonLabel}
	</Button>
</div>
