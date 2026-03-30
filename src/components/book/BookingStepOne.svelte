<script lang="ts">
	import type { Snippet } from "svelte";
	import { Button } from "$lib/components/ui/button";
	import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";
	import IframeModal from "../shared/IframeModal.svelte";
	import { bookingStepOneContent } from "../../content/booking";
	import type { BookingStepOneStudioOption } from "../../content/bookingTypes";
	import { cn } from "$lib/utils.js";
	import tableImage from "../../assets/table.jpg";
	import couchImage from "../../assets/couch.jpg";

	let {
		children: _children,
	}: {
		children?: Snippet;
	} = $props();

	const studios: BookingStepOneStudioOption[] = bookingStepOneContent.studios;
	const durations = bookingStepOneContent.durations;
	const bookingUrls = bookingStepOneContent.bookingUrls;
	const unavailableStudioId = "couch";

	const recurringBookingUrl = bookingStepOneContent.recurringBookingUrl;

	let selectedStudioId = $state("");
	let selectedDurationValue = $state("");
	let selectedBookingUrl = $derived(
		bookingUrls[selectedStudioId]?.[selectedDurationValue]?.trim() ?? "",
	);

	let showBookingModal = $state(false);
	let modalUrl = $state("");

	function openModal(url: string) {
		if (!url) {
			return;
		}

		modalUrl = url;
		showBookingModal = true;
	}

	function openBooking() {
		openModal(selectedBookingUrl);
	}

	function openRecurringBooking() {
		openModal(recurringBookingUrl);
	}
</script>

<!-- Studio Selection -->
<div class="space-y-10">
	<section class="space-y-1">
		<fieldset class="space-y-1">
			<legend
				class="text-primary mb-3 text-xs font-semibold tracking-widest uppercase">
				{bookingStepOneContent.sectionLabels.studioSelection}
			</legend>
			<RadioGroup
				bind:value={selectedStudioId}
				name="studio"
				class="grid gap-4 md:grid-cols-2">
				{#each studios as studio}
					{@const isUnavailable = studio.id === unavailableStudioId}
					<div>
						<RadioGroupItem
							id={`studio-${studio.id}`}
							value={studio.id}
							disabled={isUnavailable}
							class="peer sr-only size-0" />
						<label
							for={`studio-${studio.id}`}
							class={cn(
								"border-border bg-input peer-focus-visible:border-primary peer-focus-visible:ring-ring peer-focus-visible:ring-offset-background block overflow-hidden rounded-lg border transition duration-500 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
								!isUnavailable && "cursor-pointer hover:border-primary",
								isUnavailable &&
									"cursor-not-allowed opacity-60 saturate-0",
								selectedStudioId === studio.id && "border-primary",
							)}>
							<div class="relative h-56 w-full">
								{#if selectedStudioId === studio.id}
									<span
										class="bg-primary text-primary-foreground absolute top-3 right-3 z-10 rounded-sm px-2 py-1 text-xs font-semibold tracking-widest transition duration-500">
										{bookingStepOneContent.selectedBadge}
									</span>
								{/if}
								{#if studio.imageSlot === "table-image"}
									<img
										src={tableImage.src}
										alt={bookingStepOneContent.studios[0].alt}
										class="h-full w-full object-cover"
										width={tableImage.width}
										height={tableImage.height}
										loading="lazy"
										decoding="async" />
								{:else if studio.imageSlot === "couch-image"}
									<img
										src={couchImage.src}
										alt={bookingStepOneContent.studios[1].alt}
										class="h-full w-full object-cover"
										width={800}
										loading="lazy"
										decoding="async" />
								{/if}
								<div
									class={cn(
										"bg-background/90 absolute inset-x-0 bottom-0 px-4 py-2 backdrop-blur-xs transition duration-500",
										selectedStudioId === studio.id &&
											!isUnavailable &&
											"bg-[#393420]/90",
									)}>
									<p class="text-base font-semibold">{studio.name}</p>
									<p class="text-sm font-normal">{studio.description}</p>
									{#if isUnavailable}
										<p class="text-primary mt-1 text-xs font-semibold tracking-wide">
											This option is being changed into something better.
										</p>
									{/if}
								</div>
							</div>
						</label>
					</div>
				{/each}
			</RadioGroup>
		</fieldset>
	</section>

	<!-- Session Duration -->
	<section class="space-y-1">
		<fieldset class="space-y-1">
			<legend
				class="text-primary mb-3 text-xs font-semibold tracking-widest uppercase">
				{bookingStepOneContent.sectionLabels.sessionDuration}
			</legend>
			<RadioGroup
				bind:value={selectedDurationValue}
				name="duration"
				class="grid gap-4 sm:grid-cols-3">
				{#each durations as duration}
					<div>
						<RadioGroupItem
							id={`duration-${duration.value}`}
							value={duration.value}
							class="peer sr-only size-0" />
						<label
							for={`duration-${duration.value}`}
							class={cn(
								"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-primary peer-focus-visible:ring-ring peer-focus-visible:ring-offset-background flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-lg border px-4 py-2 transition duration-500 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
								selectedDurationValue === duration.value &&
									"border-primary bg-primary/10",
							)}>
							<p class="text-base font-semibold text-white">{duration.label}</p>
							<p class="text-primary text-sm font-medium">{duration.price}</p>
						</label>
					</div>
				{/each}
			</RadioGroup>
		</fieldset>
	</section>

	<div class="flex flex-col gap-4">
		<Button
			type="button"
			onclick={openBooking}
			disabled={!selectedBookingUrl}
			class="h-12 w-full rounded-lg text-base font-bold tracking-wider">
			{bookingStepOneContent.primaryButtonLabel}
		</Button>
		<p class="text-muted-foreground text-sm font-medium">
			{bookingStepOneContent.recurringPromptPrefix}
			<button
				type="button"
				onclick={openRecurringBooking}
				class="text-primary font-semibold hover:underline">
				{bookingStepOneContent.recurringPromptAction}
			</button>
			{bookingStepOneContent.recurringPromptSuffix}
		</p>
	</div>
</div>

{#if showBookingModal}
	<IframeModal
		bind:open={showBookingModal}
		url={modalUrl}
		dialogLabel={bookingStepOneContent.modalDialogLabel}
		closeLabel={bookingStepOneContent.modalCloseLabel}
		iframeTitle={bookingStepOneContent.modalIframeTitle}
		onClose={() => {
			modalUrl = "";
		}} />
{/if}
