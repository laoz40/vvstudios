<script lang="ts">
	import type { DateValue } from "@internationalized/date";
	import { Calendar } from "$lib/components/ui/calendar";
	import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";
	import { cn } from "$lib/utils.js";
	import type {
		BookingStepTwoContent,
		BookingStepTwoDurationOption,
	} from "../../../content/bookingTypes";
	import type { BookingErrors } from "./booking-types";
	import FieldError from "./FieldError.svelte";

	type Props = {
		sectionCopy: BookingStepTwoContent["sections"];
		durationOptions: BookingStepTwoDurationOption[];
		selectedDate?: DateValue;
		selectedDuration?: string;
		errors: BookingErrors;
		minDate: DateValue;
		pressableClass: string;
		bookingDateCalendarEl?: HTMLElement | null;
		bookingDurationGroupEl?: HTMLElement | null;
	};

	let {
		sectionCopy,
		durationOptions,
		selectedDate = $bindable(),
		selectedDuration = $bindable(""),
		errors,
		minDate,
		pressableClass,
		bookingDateCalendarEl = $bindable(null),
		bookingDurationGroupEl = $bindable(null),
	}: Props = $props();
</script>

<div class="space-y-6">
	<h2 class="text-foreground text-xl font-bold">
		{sectionCopy.bookingDetailsTitle}
	</h2>
	<div class="space-y-10">
		<div
			class="grid gap-8 md:grid-cols-[max-content_minmax(0,1fr)] md:items-stretch md:justify-between md:gap-8">
			<div class="flex h-full w-full flex-col md:w-fit md:self-stretch">
				<fieldset class="flex h-full flex-col">
					<legend
						id="booking-date-label"
						class="text-primary text-xs font-semibold tracking-widest">
						{sectionCopy.confirmBookingDateLabel}
					</legend>
					<div class="flex flex-1 flex-col gap-3 pt-3">
						<Calendar
							bind:ref={bookingDateCalendarEl}
							type="single"
							bind:value={selectedDate}
							minValue={minDate}
							captionLayout="dropdown"
							aria-labelledby="booking-date-label"
							class="border-border h-full flex-1 rounded-lg border [--cell-size:--spacing(9)] md:w-fit" />
						<FieldError
							id="booking-date-error"
							message={errors.date} />
					</div>
				</fieldset>
			</div>

			<div class="flex h-full flex-col gap-3">
				<fieldset class="flex flex-1 flex-col">
					<legend class="text-primary mb-3 text-xs font-semibold tracking-widest">
						{sectionCopy.confirmSessionDurationLabel}
					</legend>
					<RadioGroup
						bind:ref={bookingDurationGroupEl}
						bind:value={selectedDuration}
						name="sessionDuration"
						class="flex flex-1 flex-col justify-between gap-4">
						{#each durationOptions as option}
							<div>
								<RadioGroupItem
									id={`session-duration-${option.value}`}
									value={option.value}
									class="peer sr-only size-0" />
								<label
									for={`session-duration-${option.value}`}
									class={cn(
										"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 flex cursor-pointer items-center rounded-lg border px-4 py-6 text-left transition duration-300! peer-focus-visible:ring-[3px]",
										pressableClass,
										selectedDuration === option.value &&
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
										{#if selectedDuration === option.value}
											<span class="bg-primary text-primary-foreground rounded-sm px-2 py-1 text-xs font-semibold tracking-widest">
												{sectionCopy.selectedBadge}
											</span>
										{/if}
									</div>
								</label>
							</div>
						{/each}
					</RadioGroup>
				</fieldset>
				<FieldError message={errors.duration} />
			</div>
		</div>
	</div>
</div>
