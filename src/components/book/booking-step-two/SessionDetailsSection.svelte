<script lang="ts">
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
	import type {
		BookingStepTwoAddOnOption,
		BookingStepTwoContent,
	} from "../../../content/bookingTypes";
	import type { BookingErrors } from "./booking-types";
	import FieldError from "./FieldError.svelte";

	type Props = {
		sectionCopy: BookingStepTwoContent["sections"];
		addOnOptions: BookingStepTwoAddOnOption[];
		videoFormatOptions: BookingStepTwoContent["videoFormatOptions"];
		contactPhone: string;
		contactEmail: string;
		hasSavedBookingData: boolean;
		pressableClass: string;
		selectedAddOns?: string[];
		selectedVideoFormat?: string;
		questionsOrRequests?: string;
		errors: BookingErrors;
		videoFormatGroupEl?: HTMLElement | null;
		onReuseLastBooking: () => void | Promise<void>;
		onFieldBlur: (event: FocusEvent) => void;
	};

	let {
		sectionCopy,
		addOnOptions,
		videoFormatOptions,
		contactPhone,
		contactEmail,
		hasSavedBookingData,
		pressableClass,
		selectedAddOns = $bindable([]),
		selectedVideoFormat = $bindable(""),
		questionsOrRequests = $bindable(""),
		errors,
		videoFormatGroupEl = $bindable(null),
		onReuseLastBooking,
		onFieldBlur,
	}: Props = $props();

	function toggleAddOn(value: string, checked: boolean): void {
		selectedAddOns = checked
			? [...selectedAddOns, value]
			: selectedAddOns.filter((item) => item !== value);
	}
</script>

<div class="space-y-6">
	<h2 class="text-foreground text-xl font-bold">
		{sectionCopy.sessionDetailsTitle}
	</h2>

	<div class="space-y-10">
		{#if hasSavedBookingData}
			<div
				class="border-primary bg-input/30 mb-8 flex flex-col items-end justify-between gap-6 rounded-lg border p-4 sm:flex-row sm:items-center sm:gap-0">
				<p class="text-muted-foreground w-full text-sm">
					{sectionCopy.reuseSavedBookingText}
				</p>
				<Button
					type="button"
					variant="default"
					class={cn("rounded-lg", pressableClass)}
					onclick={onReuseLastBooking}>
					{sectionCopy.reuseSavedBookingButton}
				</Button>
			</div>
		{/if}

		<div class="space-y-5">
			<fieldset>
				<legend class="text-primary text-xs font-semibold tracking-widest">
					{sectionCopy.addOnsLegend}
				</legend>
				<div class="mt-4 space-y-4">
					<p class="text-muted-foreground text-sm">
						{sectionCopy.addOnsHelper}
					</p>
					<div class="grid gap-4 md:grid-cols-2">
						{#each addOnOptions as option}
							<div class="h-full">
								<Checkbox
									id={`addon-${option.value}`}
									name="addOns"
									value={option.value}
									checked={selectedAddOns.includes(option.value)}
									onCheckedChange={(checked) => toggleAddOn(option.value, checked)}
									class="peer sr-only size-0" />
								<label
									for={`addon-${option.value}`}
									class={cn(
										"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 flex h-full min-h-40 cursor-pointer flex-col gap-4 rounded-lg border px-4 py-4 text-left transition duration-300! peer-focus-visible:ring-[3px]",
										pressableClass,
										selectedAddOns.includes(option.value) &&
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

										{#if selectedAddOns.includes(option.value)}
											<span class="bg-primary text-primary-foreground mt-1 rounded-sm px-2 py-1 text-xs font-semibold tracking-widest">
												{sectionCopy.selectedBadge}
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
					{sectionCopy.videoFormatLegend}
				</legend>
				<div class="mt-4">
					<RadioGroup
						bind:ref={videoFormatGroupEl}
						bind:value={selectedVideoFormat}
						name="videoFormat"
						class="grid gap-4">
						{#each videoFormatOptions as option}
							<div>
								<RadioGroupItem
									id={`video-format-${option.value}`}
									value={option.value}
									class="peer sr-only size-0" />
								<label
									for={`video-format-${option.value}`}
									class={cn(
										"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 flex min-h-28 cursor-pointer items-center justify-start gap-4 rounded-lg border px-4 py-5 text-left transition duration-300! peer-focus-visible:ring-[3px] sm:min-h-0",
										pressableClass,
										selectedVideoFormat === option.value &&
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
										{#if selectedVideoFormat === option.value}
											<span class="bg-primary text-primary-foreground rounded-sm px-2 py-1 text-xs font-semibold tracking-widest">
												{sectionCopy.selectedBadge}
											</span>
										{/if}
									</div>
								</label>
							</div>
						{/each}
					</RadioGroup>
				</div>
			</fieldset>
			<FieldError message={errors.videoFormat} />
		</div>

		<div class="space-y-5">
			<Label
				for="questionsOrRequests"
				class="text-primary text-xs font-semibold tracking-widest">
				{sectionCopy.questionsLabel}
			</Label>
			<div class="space-y-3">
				<Textarea
					id="questionsOrRequests"
					name="questionsOrRequests"
					autocomplete="off"
					bind:value={questionsOrRequests}
					onblur={onFieldBlur}
					rows={2}
					class="bg-background selection:bg-primary selection:text-primary-foreground rounded-lg shadow-xs"
					placeholder={sectionCopy.questionsPlaceholder} />
				<FieldError message={errors.questionsOrRequests} />
				<p class="text-muted-foreground text-sm">
					{sectionCopy.questionsContactPrefix}
					<Button
						variant="link"
						class="text-foreground decoration-primary/65 hover:text-primary p-0 underline underline-offset-4 transition-colors duration-150"
						href={`tel:${contactPhone}`}>
						{contactPhone}
					</Button>
					{sectionCopy.questionsContactMiddle}
					<Button
						variant="link"
						class="text-foreground decoration-primary/65 hover:text-primary p-0 underline underline-offset-4 transition-colors duration-150"
						href={`mailto:${contactEmail}`}>
						{contactEmail}
					</Button>
				</p>
			</div>
		</div>
	</div>
</div>
