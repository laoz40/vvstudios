<script lang="ts">
import { Button } from "$lib/components/ui/button";
import { Label } from "$lib/components/ui/label";
import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";
import { cn } from "$lib/utils.js";
import type { Snippet } from "svelte";

let {
	children: _children,
}: {
	children?: Snippet;
} = $props();

type StudioOption = {
	id: string;
	name: string;
	description: string;
	imageSlot: "table-image" | "couch-image";
	alt: string;
};

type DurationOption = {
	value: string;
	label: string;
	price: string;
};

type BookingUrlMap = Record<string, Record<string, string>>;

const studios: StudioOption[] = [
	{
		id: "table",
		name: "Table Setup",
		description: "For your serious discussions",
		imageSlot: "table-image",
		alt: "Podcast table setup with microphones and studio lighting",
	},
	{
		id: "couch",
		name: "Couch Setup",
		description: "A more relaxed vibe",
		imageSlot: "couch-image",
		alt: "Podcast couch setup with warm lamps and casual seating",
	},
];

const durations: DurationOption[] = [
	{ value: "1", label: "1 Hour", price: "$200" },
	{ value: "2", label: "2 Hours", price: "$299" },
	{ value: "3", label: "3 Hours", price: "$399" },
];

const bookingUrls: BookingUrlMap = {
	table: {
		"1": import.meta.env.PUBLIC_BOOKING_TABLE_1_URL || "",
		"2": import.meta.env.PUBLIC_BOOKING_TABLE_2_URL || "",
		"3": import.meta.env.PUBLIC_BOOKING_TABLE_3_URL || "",
	},
	couch: {
		"1": import.meta.env.PUBLIC_BOOKING_COUCH_1_URL || "",
		"2": import.meta.env.PUBLIC_BOOKING_COUCH_2_URL || "",
		"3": import.meta.env.PUBLIC_BOOKING_COUCH_3_URL || "",
	},
};

const recurringBookingUrl = "https://calendar.app.google/oFhhKtMnJoa2WX9h7";

let selectedStudioId = $state("");
let selectedDurationValue = $state("");
let selectedBookingUrl = $derived(
	bookingUrls[selectedStudioId]?.[selectedDurationValue]?.trim() ?? "",
);

let showBookingModal = $state(false);
let modalUrl = $state("");

function openBooking() {
	if (!selectedBookingUrl) {
		return;
	}

	modalUrl = selectedBookingUrl;
	showBookingModal = true;
}

function openRecurringBooking() {
	modalUrl = recurringBookingUrl;
	showBookingModal = true;
}

function closeBooking() {
	showBookingModal = false;
	modalUrl = "";
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
</script>

<svelte:window onkeydown={handleKeydown} />

		<!-- Studio Selection -->
<div class="space-y-14">
	<section class="space-y-1">
		<Label class="text-primary text-xs font-semibold tracking-widest uppercase"
		>Studio Selection</Label
		>
		<RadioGroup bind:value={selectedStudioId} name="studio" class="grid gap-4 md:grid-cols-2">
			{#each studios as studio}
				<div>
					<RadioGroupItem id={`studio-${studio.id}`} value={studio.id} class="sr-only" />
					<label
						for={`studio-${studio.id}`}
						class={cn(
							"block cursor-pointer overflow-hidden border border-border bg-input transition duration-500 hover:border-primary",
							selectedStudioId === studio.id && "border-primary",
						)}
					>
						<div class="relative h-56 w-full">
							{#if selectedStudioId === studio.id}
								<span
									class="bg-primary text-primary-foreground absolute top-3 right-3 z-10 px-2 py-1 text-xs font-semibold tracking-widest transition duration-500"
								>
									SELECTED
								</span>
							{/if}
							{#if studio.imageSlot === "table-image"}
								<slot name="table-image" {studio}></slot>
							{:else if studio.imageSlot === "couch-image"}
								<slot name="couch-image" {studio}></slot>
							{/if}
							<div class={cn("absolute inset-x-0 bottom-0 bg-background/90 px-4 py-2 backdrop-blur-xs transition duration-500", selectedStudioId === studio.id && "bg-[#151308]/90")}>
								<p class="text-base font-semibold text-white">{studio.name}</p>
								<p class="text-sm font-normal">{studio.description}</p>
							</div>
						</div>
					</label>
				</div>
			{/each}
		</RadioGroup>
	</section>

		<!-- Session Duration -->
	<section class="space-y-1">
		<Label class="text-primary text-xs font-semibold tracking-widest uppercase"
		>Session Duration</Label
		>
		<RadioGroup
			bind:value={selectedDurationValue}
			name="duration"
			class="grid gap-4 sm:grid-cols-3"
		>
			{#each durations as duration}
				<div>
					<RadioGroupItem id={`duration-${duration.value}`} value={duration.value} class="sr-only" />
					<label
						for={`duration-${duration.value}`}
						class={cn(
							"flex min-h-14 cursor-pointer flex-col items-center justify-center border border-border bg-input/30 px-4 py-2 transition duration-500 hover:border-primary hover:bg-primary/10",
							selectedDurationValue === duration.value && "border-primary bg-primary/10",
						)}
					>
						<p class="text-base font-semibold text-white">{duration.label}</p>
						<p class="text-primary text-sm font-medium">{duration.price}</p>
					</label>
				</div>
			{/each}
		</RadioGroup>
	</section>

	<div class="flex flex-col gap-4">
	<Button
		type="button"
		onclick={openBooking}
		disabled={!selectedBookingUrl}
		class="h-12 w-full rounded-none text-base font-extrabold tracking-wider"
	>
		PICK SESSION DATE
	</Button>
	<p class="text-sm font-medium text-muted-foreground">
		Need recurring sessions?
		<button
			type="button"
			onclick={openRecurringBooking}
			class="text-primary font-semibold hover:underline"
		>
			Request a call
		</button>
		to lock in your slot and secure a discounted rate.
	</p>
	</div>
</div>

{#if showBookingModal}
	<div
		class="fixed inset-0 z-9999 box-border bg-black/70 p-4 sm:p-18"
		onclick={handleOverlayClick}
		onkeydown={(e) => (e.key === "Enter" || e.key === " " || e.key === "Escape") && closeBooking()}
		role="button"
		tabindex="-1"
		aria-label="Close modal"
	>
		<Button
			variant="default"
			onclick={closeBooking}
			class="fixed top-4 right-4 z-10000 flex h-9 items-center gap-2 px-4 sm:top-6.5 sm:right-18"
		>
			Close
		</Button>
	<iframe
		title="Choose a session"
		src={modalUrl}
		class="h-full w-full rounded-lg border-none bg-white"
		sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-storage-access-by-user-activation"
	></iframe>
</div>
{/if}
