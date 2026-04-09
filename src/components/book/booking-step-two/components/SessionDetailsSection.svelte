<script lang="ts">
	import { getContext, onMount } from "svelte";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import MonitorIcon from "@lucide/svelte/icons/monitor";
	import ScrollTextIcon from "@lucide/svelte/icons/scroll-text";
	import ScissorsIcon from "@lucide/svelte/icons/scissors";
	import SmartphoneIcon from "@lucide/svelte/icons/smartphone";
	import { Button } from "$lib/components/ui/button";
	import { Checkbox } from "$lib/components/ui/checkbox";
	import { Label } from "$lib/components/ui/label";
	import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";
	import { Textarea } from "$lib/components/ui/textarea";
	import { cn } from "$lib/utils.js";
	import {
		BOOKING_STEP_TWO_CONTEXT,
		type BookingStepTwoContext,
	} from "./booking-store.svelte";
	import FieldError from "./components/FieldError.svelte";

	const booking = getContext<BookingStepTwoContext>(BOOKING_STEP_TWO_CONTEXT);
	const { state: bookingState, ui, actions } = booking;

	let videoFormatGroupEl: HTMLElement | null = $state(null);

	function focusVideoFormatField(): void {
		videoFormatGroupEl?.scrollIntoView({
			behavior: "smooth",
			block: "center",
		});
		document
			.getElementById(`video-format-${ui.videoFormatOptions[0]?.value}`)
			?.focus();
	}

	function focusQuestionsField(): void {
		document.getElementById("questionsOrRequests")?.focus();
	}

	onMount(() => {
		const unregisterVideoFormat = actions.registerFieldFocus(
			"videoFormat",
			focusVideoFormatField,
		);
		const unregisterQuestions = actions.registerFieldFocus(
			"questionsOrRequests",
			focusQuestionsField,
		);

		return () => {
			unregisterVideoFormat();
			unregisterQuestions();
		};
	});
</script>

<div class="space-y-6">
	<h2 class="text-foreground text-xl font-bold">
		{ui.sectionCopy.sessionDetailsTitle}
	</h2>

	<div class="space-y-10">
		{#if bookingState.hasSavedBookingData}
			<div
				class="border-primary bg-input/30 mb-8 flex flex-col items-end justify-between gap-6 rounded-lg border p-4 sm:flex-row sm:items-center sm:gap-0">
				<p class="text-muted-foreground w-full text-sm">
					{ui.sectionCopy.reuseSavedBookingText}
				</p>
				<Button
					type="button"
					variant="default"
					class={cn("rounded-lg", ui.pressableClass)}
					onclick={actions.reuseLastBooking}>
					{ui.sectionCopy.reuseSavedBookingButton}
				</Button>
			</div>
		{/if}

		<div class="space-y-5">
			<fieldset>
				<legend class="text-primary text-xs font-semibold tracking-widest">
					{ui.sectionCopy.addOnsLegend}
				</legend>
				<div class="mt-4 space-y-4">
					<p class="text-muted-foreground text-sm">
						{ui.sectionCopy.addOnsHelper}
					</p>
					<div class="grid gap-4 md:grid-cols-2">
						{#each ui.addOnOptions as option}
							<div class="h-full">
								<Checkbox
									id={`addon-${option.value}`}
									name="addOns"
									value={option.value}
									checked={bookingState.form.selectedAddOns.includes(option.value)}
									onCheckedChange={(checked) =>
										actions.toggleAddOn(option.value, checked)}
									class="peer sr-only size-0" />
								<label
									for={`addon-${option.value}`}
									class={cn(
										"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 flex h-full min-h-40 cursor-pointer flex-col gap-4 rounded-lg border px-4 py-4 text-left transition duration-300! peer-focus-visible:ring-[3px]",
										ui.pressableClass,
										bookingState.form.selectedAddOns.includes(option.value) &&
											"border-primary bg-primary/10",
									)}>
									<div class="flex flex-row items-start justify-between">
										{#if option.icon === "camera"}
											<CameraIcon class="text-primary size-10" />
										{:else if option.icon === "scroll-text"}
											<ScrollTextIcon class="text-primary size-10" />
										{:else if option.icon === "scissors"}
											<ScissorsIcon class="text-primary size-10" />
										{:else}
											<SmartphoneIcon class="text-primary size-10" />
										{/if}

										{#if bookingState.form.selectedAddOns.includes(option.value)}
											<span class="bg-primary text-primary-foreground mt-1 rounded-sm px-2 py-1 text-xs font-semibold tracking-widest">
												{ui.sectionCopy.selectedBadge}
											</span>
										{/if}
									</div>
									<div class="flex flex-col gap-1.5">
										<div class="flex items-start justify-between gap-4">
											<span class="text-base font-semibold text-white">
												{option.label}
											</span>
											<span class="text-primary text-base">
												{option.price}
											</span>
										</div>
										<p class="text-muted-foreground text-sm font-normal text-pretty">
											{option.description}
										</p>
									</div>
								</label>
							</div>
						{/each}
					</div>
				</div>
			</fieldset>
		</div>

		<div class="space-y-5">
			<fieldset>
				<legend class="text-primary text-xs font-semibold tracking-widest">
					{ui.sectionCopy.videoFormatLegend}
				</legend>
				<div class="mt-4">
					<RadioGroup
						bind:ref={videoFormatGroupEl}
						bind:value={bookingState.form.selectedVideoFormat}
						name="videoFormat"
						class="grid gap-4">
						{#each ui.videoFormatOptions as option}
							<div>
								<RadioGroupItem
									id={`video-format-${option.value}`}
									value={option.value}
									class="peer sr-only size-0" />
								<label
									for={`video-format-${option.value}`}
									class={cn(
										"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 flex min-h-28 cursor-pointer items-center justify-start gap-4 rounded-lg border px-4 py-5 text-left transition duration-300! peer-focus-visible:ring-[3px] sm:min-h-0",
										ui.pressableClass,
										bookingState.form.selectedVideoFormat === option.value &&
											"border-primary bg-primary/10",
									)}>
									{#if option.icon === "monitor"}
										<div class="flex h-7 w-11 shrink-0 items-center justify-center">
											<MonitorIcon class="text-primary size-7" />
										</div>
									{:else if option.icon === "smartphone"}
										<div class="flex h-7 w-11 shrink-0 items-center justify-center">
											<SmartphoneIcon class="text-primary size-7" />
										</div>
									{:else}
										<div class="flex h-7 w-11 shrink-0 items-center justify-center gap-1">
											<SmartphoneIcon class="text-primary size-5" />
											<MonitorIcon class="text-primary size-5" />
										</div>
									{/if}
									<div class="flex w-full items-center justify-between gap-3">
										<div class="flex flex-col gap-1">
											<span class="block text-base font-semibold text-white">
												{option.label}
											</span>
											<span class="text-muted-foreground block text-sm font-normal text-pretty">
												{option.description}
											</span>
										</div>
										{#if bookingState.form.selectedVideoFormat === option.value}
											<span class="bg-primary text-primary-foreground rounded-sm px-2 py-1 text-xs font-semibold tracking-widest">
												{ui.sectionCopy.selectedBadge}
											</span>
										{/if}
									</div>
								</label>
							</div>
						{/each}
					</RadioGroup>
				</div>
			</fieldset>
			<FieldError message={bookingState.errors.videoFormat} />
		</div>

		<div class="space-y-5">
			<Label
				for="questionsOrRequests"
				class="text-primary text-xs font-semibold tracking-widest">
				{ui.sectionCopy.questionsLabel}
			</Label>
			<div class="space-y-3">
				<Textarea
					id="questionsOrRequests"
					name="questionsOrRequests"
					autocomplete="off"
					bind:value={bookingState.form.questionsOrRequests}
					onblur={actions.handleFieldBlur}
					rows={2}
					class="bg-background selection:bg-primary selection:text-primary-foreground rounded-lg shadow-xs"
					placeholder={ui.sectionCopy.questionsPlaceholder} />
				<FieldError message={bookingState.errors.questionsOrRequests} />
				<p class="text-muted-foreground text-sm">
					{ui.sectionCopy.questionsContactPrefix}
					<Button
						variant="link"
						class="text-foreground decoration-primary/65 hover:text-primary p-0 underline underline-offset-4 transition-colors duration-150"
						href={`tel:${ui.contactPhone}`}>
						{ui.contactPhone}
					</Button>
					{ui.sectionCopy.questionsContactMiddle}
					<Button
						variant="link"
						class="text-foreground decoration-primary/65 hover:text-primary p-0 underline underline-offset-4 transition-colors duration-150"
						href={`mailto:${ui.contactEmail}`}>
						{ui.contactEmail}
					</Button>
				</p>
			</div>
		</div>
	</div>
</div>
