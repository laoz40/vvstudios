<script lang="ts">
	import { getContext } from "svelte";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import ScissorsIcon from "@lucide/svelte/icons/scissors";
	import SmartphoneIcon from "@lucide/svelte/icons/smartphone";
	import { Button } from "$lib/components/ui/button";
	import { Checkbox } from "$lib/components/ui/checkbox";
	import { cn } from "$lib/utils.js";
	import {
		BOOKING_STEP_TWO_CONTEXT,
		type BookingStepTwoContext,
	} from "../booking-store.svelte";
	import SelectedCheckBadge from "../../../shared/SelectedCheckBadge.svelte";

	const booking = getContext<BookingStepTwoContext>(BOOKING_STEP_TWO_CONTEXT);
	const { state: bookingState, ui, actions } = booking;
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
					<div class="flex flex-col gap-4">
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
										"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 flex h-full cursor-pointer items-center justify-between gap-4 rounded-lg border px-4 py-6 text-left transition duration-300! peer-focus-visible:ring-[3px]",
										ui.pressableClass,
										bookingState.form.selectedAddOns.includes(option.value) &&
											"border-primary bg-primary/10",
									)}>
									<div class="flex min-w-0 items-center gap-4">
										<div class="flex shrink-0 items-center justify-center">
											{#if option.icon === "camera"}
												<CameraIcon class="text-primary size-8" />
											{:else if option.icon === "scissors"}
												<ScissorsIcon class="text-primary size-8" />
											{:else}
												<SmartphoneIcon class="text-primary size-8" />
											{/if}
										</div>

										<div class="min-w-0">
											<div class="flex items-center gap-2">
												<span class="text-foreground text-base font-semibold">
													{option.label}
												</span>
												{#if bookingState.form.selectedAddOns.includes(option.value)}
													<SelectedCheckBadge />
												{/if}
											</div>
											<div>
												<p class="text-muted-foreground text-sm font-normal text-pretty">
													{option.description}
												</p>
											</div>
										</div>
									</div>

									<span class="text-primary shrink-0 text-base font-semibold">
										{option.price}
									</span>
								</label>
							</div>
						{/each}
					</div>
				</div>
			</fieldset>
		</div>
	</div>
</div>
