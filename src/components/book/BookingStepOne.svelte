<script lang="ts">
	import { onDestroy, tick } from "svelte";
	import type { Snippet } from "svelte";
	import { Button } from "$lib/components/ui/button";
	import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";
	import { bookingStepOneContent } from "../../content/booking";
	import type { BookingStepOneStudioOption } from "../../content/bookingTypes";
	import { cn } from "$lib/utils.js";

	let {
		children: _children,
	}: {
		children?: Snippet;
	} = $props();

	const studios: BookingStepOneStudioOption[] = bookingStepOneContent.studios;
	const durations = bookingStepOneContent.durations;
	const bookingUrls = bookingStepOneContent.bookingUrls;

	const recurringBookingUrl = bookingStepOneContent.recurringBookingUrl;

	let selectedStudioId = $state("");
	let selectedDurationValue = $state("");
	let selectedBookingUrl = $derived(
		bookingUrls[selectedStudioId]?.[selectedDurationValue]?.trim() ?? "",
	);

	let showBookingModal = $state(false);
	let modalUrl = $state("");
	let lastFocusedEl: HTMLElement | null = $state(null);
	let closeButtonEl: HTMLButtonElement | null = $state(null);

	function portal(node: HTMLElement) {
		if (typeof document === "undefined") {
			return;
		}

		document.body.appendChild(node);

		return {
			destroy() {
				node.remove();
			},
		};
	}

	function setBackgroundInert(isInert: boolean) {
		if (typeof document === "undefined") {
			return;
		}

		const inertTargets = [
			document.getElementById("site-shell"),
			document.getElementById("mobile-nav-shell"),
		];

		for (const target of inertTargets) {
			if (!target) continue;
			target.inert = isInert;
		}
	}

	function openBooking() {
		if (!selectedBookingUrl) {
			return;
		}

		if (typeof document !== "undefined") {
			lastFocusedEl = document.activeElement as HTMLElement | null;
		}
		modalUrl = selectedBookingUrl;
		showBookingModal = true;
		setBackgroundInert(true);
		void tick().then(() => closeButtonEl?.focus());
	}

	function openRecurringBooking() {
		if (typeof document !== "undefined") {
			lastFocusedEl = document.activeElement as HTMLElement | null;
		}
		modalUrl = recurringBookingUrl;
		showBookingModal = true;
		setBackgroundInert(true);
		void tick().then(() => closeButtonEl?.focus());
	}

	function closeBooking() {
		showBookingModal = false;
		modalUrl = "";
		setBackgroundInert(false);

		if (lastFocusedEl?.isConnected) {
			lastFocusedEl.focus();
		}
		lastFocusedEl = null;
	}

	function handleOverlayClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			closeBooking();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === "Escape") {
			closeBooking();
		}
	}

	onDestroy(() => {
		setBackgroundInert(false);
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Studio Selection -->
<div class="space-y-14">
	<section class="space-y-1">
		<fieldset class="space-y-1">
			<legend
				class="text-primary text-xs font-semibold tracking-widest uppercase">
				{bookingStepOneContent.sectionLabels.studioSelection}
			</legend>
			<RadioGroup
				bind:value={selectedStudioId}
				name="studio"
				class="grid gap-4 md:grid-cols-2">
				{#each studios as studio}
					<div>
						<RadioGroupItem
							id={`studio-${studio.id}`}
							value={studio.id}
							class="peer sr-only" />
						<label
							for={`studio-${studio.id}`}
							class={cn(
								"border-border bg-input hover:border-primary peer-focus-visible:border-primary peer-focus-visible:ring-ring peer-focus-visible:ring-offset-background block cursor-pointer overflow-hidden rounded-lg border transition duration-500 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
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
									<slot
										name="table-image"
										{studio}></slot>
								{:else if studio.imageSlot === "couch-image"}
									<slot
										name="couch-image"
										{studio}></slot>
								{/if}
								<div
									class={cn(
										"bg-background/90 absolute inset-x-0 bottom-0 px-4 py-2 backdrop-blur-xs transition duration-500",
										selectedStudioId === studio.id && "bg-[#393420]/90",
									)}>
									<p class="text-base font-semibold">{studio.name}</p>
									<p class="text-sm font-normal">{studio.description}</p>
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
				class="text-primary text-xs font-semibold tracking-widest uppercase">
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
							class="peer sr-only" />
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
	<div
		use:portal
		class="fixed inset-0 z-9999 box-border bg-black/70 p-4 sm:p-18"
		onclick={handleOverlayClick}
		role="dialog"
		aria-modal="true"
		aria-label={bookingStepOneContent.modalAriaLabel}>
		<Button
			variant="default"
			bind:ref={closeButtonEl}
			onclick={closeBooking}
			class="fixed top-4 right-4 z-10000 flex h-9 items-center gap-2 rounded-lg px-4 sm:top-6.5 sm:right-18">
			{bookingStepOneContent.modalCloseLabel}
		</Button>
		<iframe
			title={bookingStepOneContent.modalIframeTitle}
			src={modalUrl}
			class="h-full w-full rounded-lg border-none bg-white"
			sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-storage-access-by-user-activation"
		></iframe>
	</div>
{/if}
