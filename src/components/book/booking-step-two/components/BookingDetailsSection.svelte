<script lang="ts">
	import { getContext, onMount } from "svelte";
	import { Calendar } from "$lib/components/ui/calendar";
	import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";
	import { cn } from "$lib/utils.js";
	import {
		BOOKING_STEP_TWO_CONTEXT,
		type BookingStepTwoContext,
	} from "../booking-store.svelte";
	import FieldError from "../components/FieldError.svelte";
	import SelectedCheckBadge from "../../../shared/SelectedCheckBadge.svelte";

	const { state: bookingState, ui, actions } = getContext<BookingStepTwoContext>(BOOKING_STEP_TWO_CONTEXT);

	let bookingDateCalendarEl: HTMLElement | null = $state(null);
	let bookingDurationGroupEl: HTMLElement | null = $state(null);

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
			.getElementById(`session-duration-${ui.durationOptions[0]?.value}`)
			?.focus();
	}

	onMount(() => {
		const unregisterDate = actions.registerFieldFocus("date", focusCalendarControl);
		const unregisterDuration = actions.registerFieldFocus(
			"duration",
			focusDurationField,
		);

		return () => {
			unregisterDate();
			unregisterDuration();
		};
	});
</script>

<div class="space-y-6">
	<h2 class="text-foreground text-xl font-bold">
		{ui.sectionCopy.bookingDetailsTitle}
	</h2>
	<div class="space-y-10">
		<div
			class="grid gap-8 md:grid-cols-[max-content_minmax(0,1fr)] md:items-stretch md:justify-between md:gap-8">
			<div class="flex h-full w-full flex-col md:w-fit md:self-stretch">
				<fieldset class="flex h-full flex-col">
					<legend
						id="booking-date-label"
						class="text-primary text-xs font-semibold tracking-widest">
						{ui.sectionCopy.confirmBookingDateLabel}
					</legend>
					<div class="flex flex-1 flex-col gap-3 pt-3">
						<Calendar
							bind:ref={bookingDateCalendarEl}
							type="single"
							bind:value={bookingState.form.selectedDate}
							minValue={ui.minDate}
							captionLayout="dropdown"
							aria-labelledby="booking-date-label"
							class="border-border h-full flex-1 rounded-lg border [--cell-size:--spacing(9)] md:w-fit" />
						<FieldError
							id="booking-date-error"
							message={bookingState.errors.date} />
					</div>
				</fieldset>
			</div>

			<div class="flex h-full flex-col gap-3">
				<fieldset class="flex flex-1 flex-col">
					<legend class="text-primary mb-3 text-xs font-semibold tracking-widest">
						{ui.sectionCopy.confirmSessionDurationLabel}
					</legend>
					<RadioGroup
						bind:ref={bookingDurationGroupEl}
						bind:value={bookingState.form.selectedDuration}
						name="sessionDuration"
						class="flex flex-1 flex-col justify-between gap-4">
						{#each ui.durationOptions as option}
							<div>
								<RadioGroupItem
									id={`session-duration-${option.value}`}
									value={option.value}
									class="peer sr-only size-0" />
								<label
									for={`session-duration-${option.value}`}
									class={cn(
										"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 flex cursor-pointer items-center rounded-lg border px-4 py-6 text-left transition duration-300! peer-focus-visible:ring-[3px]",
										ui.pressableClass,
										bookingState.form.selectedDuration === option.value &&
											"border-primary bg-primary/10",
									)}>
									<div class="flex w-full items-center justify-between gap-3">
										<span class="flex flex-col gap-1">
											<span class="block text-base font-semibold">
												{option.label}
											</span>
											<span class="text-muted-foreground block text-sm font-normal">
												{option.description}
											</span>
										</span>
										{#if bookingState.form.selectedDuration === option.value}
											<SelectedCheckBadge />
										{/if}
									</div>
								</label>
							</div>
						{/each}
					</RadioGroup>
				</fieldset>
				<FieldError message={bookingState.errors.duration} />
			</div>
		</div>
	</div>
</div>
