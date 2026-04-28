<script lang="ts">
	import { tick } from "svelte";
	import type { Snippet } from "svelte";
	import { z } from "zod";
	import { Button } from "$lib/components/ui/button";
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog";
	import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";
	import IframeModal from "../shared/IframeModal.svelte";
	import { bookingStepOneContent } from "../../content/booking";
	import { seoPages } from "../../content/seo";
	import type { BookingStepOneStudioOption } from "../../content/bookingTypes";
	import { cn } from "$lib/utils.js";
	import tableImage from "../../assets/gallery/table-setup.jpg?enhanced";
	import armchairSetupImage from "../../assets/gallery/armchair-setup.jpg?enhanced";

	const pressableClass =
		"transform-gpu transition-[transform,border-color,background-color,color,opacity,box-shadow] duration-200 ease-out active:scale-99 active:opacity-90";

	let {
		children: _children,
	}: {
		children?: Snippet;
	} = $props();

	const studios: BookingStepOneStudioOption[] = bookingStepOneContent.studios;
	const durations = bookingStepOneContent.durations;
	const bookingUrls = bookingStepOneContent.bookingUrls;
	const recurringBookingUrl = bookingStepOneContent.recurringBookingUrl;
	const BookingStepOneSchema = z.object({
		studioId: z.string().min(1, "Please select a studio space."),
		durationValue: z.string().min(1, "Please select a session duration."),
	});

	type BookingStepOneErrors = Partial<
		Record<keyof z.infer<typeof BookingStepOneSchema>, string>
	>;

	let selectedStudioId = $state("");
	let selectedDurationValue = $state("");
	let selectedBookingUrl = $derived(
		bookingUrls[selectedStudioId]?.[selectedDurationValue]?.trim() ?? "",
	);
	let isBookingReady = $derived(
		Boolean(selectedStudioId && selectedDurationValue),
	);
	let errors: BookingStepOneErrors = $state({});

	let showBookingModal = $state(false);
	let showPostBookingNotice = $state(false);
	let modalUrl = $state("");
	let activeModalType = $state<"booking" | "recurring" | null>(null);
	let shouldAnimateBookingButton = $state(false);
	let postBookingNoticeButtonEl: HTMLButtonElement | null = $state(null);
	let studioSectionEl: HTMLElement | null = $state(null);
	let durationSectionEl: HTMLElement | null = $state(null);
	let wasBookingReady = false;

	function clearFieldError(field: keyof BookingStepOneErrors) {
		if (!errors[field]) {
			return;
		}

		const { [field]: _removed, ...rest } = errors;
		errors = rest;
	}

	function scrollToFirstInvalidSection(fieldErrors: BookingStepOneErrors) {
		if (fieldErrors.studioId) {
			studioSectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
			document.getElementById(`studio-${studios[0]?.id}`)?.focus();
			return;
		}

		if (fieldErrors.durationValue) {
			durationSectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
			document.getElementById(`duration-${durations[0]?.value}`)?.focus();
		}
	}

	function openModal(url: string, type: "booking" | "recurring") {
		if (!url) {
			return;
		}

		activeModalType = type;
		modalUrl = url;
		showBookingModal = true;
	}

	function openBooking() {
		const parsed = BookingStepOneSchema.safeParse({
			studioId: selectedStudioId,
			durationValue: selectedDurationValue,
		});

		if (!parsed.success) {
			const fieldErrors: BookingStepOneErrors = {};
			for (const issue of parsed.error.issues) {
				const key = issue.path[0] as keyof BookingStepOneErrors;
				if (key && !fieldErrors[key]) {
					fieldErrors[key] = issue.message;
				}
			}
			errors = fieldErrors;
			void tick().then(() => scrollToFirstInvalidSection(fieldErrors));
			return;
		}

		errors = {};
		if (!selectedBookingUrl) {
			return;
		}

		showPostBookingNotice = true;
	}

	function openRecurringBooking() {
		openModal(recurringBookingUrl, "recurring");
	}

	function dismissPostBookingNotice() {
		showPostBookingNotice = false;

		if (typeof window === "undefined" || !selectedBookingUrl) {
			return;
		}

		window.location.assign(selectedBookingUrl);
	}

	function navigateToFinaliseBooking() {
		if (typeof window === "undefined") {
			return;
		}

		window.location.assign(seoPages.finaliseBooking.path);
	}

	$effect(() => {
		if (!showPostBookingNotice) {
			return;
		}

		void tick().then(() => postBookingNoticeButtonEl?.focus());
	});

	$effect(() => {
		if (!selectedStudioId) {
			return;
		}

		clearFieldError("studioId");
	});

	$effect(() => {
		if (!selectedDurationValue) {
			return;
		}

		clearFieldError("durationValue");
	});

	$effect(() => {
		if (isBookingReady && !wasBookingReady) {
			shouldAnimateBookingButton = true;

			const timeoutId = window.setTimeout(() => {
				shouldAnimateBookingButton = false;
			}, 700);

			wasBookingReady = true;

			return () => window.clearTimeout(timeoutId);
		}

		wasBookingReady = isBookingReady;
	});
</script>

<!-- Studio Selection -->
<div class="space-y-7 md:space-y-10">
	<section
		bind:this={studioSectionEl}
		class="scroll-mt-32 space-y-1 sm:scroll-mt-40">
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
					{@const isSelected = selectedStudioId === studio.id}
					<div>
						<RadioGroupItem
							id={`studio-${studio.id}`}
							value={studio.id}
							class="peer sr-only size-0" />
						<label
							for={`studio-${studio.id}`}
							class={cn(
								"booking-studio-card border-border bg-input/30 hover:border-primary/70 peer-focus-visible:border-primary peer-focus-visible:ring-ring peer-focus-visible:ring-offset-background group relative block cursor-pointer overflow-hidden rounded-xl border shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
								pressableClass,
								isSelected && "border-primary booking-option-surface",
							)}>
							<div class="aspect-video w-full overflow-hidden bg-input/30">
								{#if studio.imageSlot === "table-image"}
									<enhanced:img
										src={tableImage}
										alt={bookingStepOneContent.studios[0].alt}
										class={cn(
											"h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 group-active:scale-105",
											isSelected && "scale-102",
										)}
										loading="lazy"
										decoding="async" />
								{:else if studio.imageSlot === "armchair-image"}
									<enhanced:img
										src={armchairSetupImage}
										alt={bookingStepOneContent.studios[1].alt}
										class={cn(
											"h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105 group-active:scale-105",
											isSelected && "scale-102",
										)}
										loading="lazy"
										decoding="async" />
								{/if}
							</div>
							<div
								class="booking-studio-card-footer absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 overflow-hidden px-4 py-1 transition-colors duration-200 ease-out md:relative md:bottom-auto md:inset-x-auto md:py-2">
								<div class="relative z-10 min-w-0">
									<p class="text-base font-semibold">{studio.name}</p>
								</div>
								<span
									class={cn(
										"relative z-10",
										"inline-flex min-w-20 items-center justify-center rounded-full border px-3 py-0.5 md:py-2 text-xs font-medium tracking-wide uppercase transition-colors duration-200 ease-out shadow-md",
										isSelected
											? "border-primary bg-primary text-primary-foreground"
											: "border-border bg-background/50 text-foreground group-hover:border-border group-hover:text-primary",
									)}>
									{isSelected ? "Selected" : "Select"}
								</span>
							</div>
						</label>
					</div>
				{/each}
			</RadioGroup>
		</fieldset>
		{#if errors.studioId}
			<p
				class="text-destructive text-xs"
				role="alert">
				{errors.studioId}
			</p>
		{/if}
	</section>

	<!-- Session Duration -->
	<section
		bind:this={durationSectionEl}
		class="scroll-mt-32 space-y-1 sm:scroll-mt-40">
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
					{@const hasDiscount =
						duration.originalPrice !== duration.discountedPrice}
					{@const isSelected = selectedDurationValue === duration.value}
					<div>
						<RadioGroupItem
							id={`duration-${duration.value}`}
							value={duration.value}
							class="peer sr-only size-0" />
						<label
							for={`duration-${duration.value}`}
							class={cn(
								"booking-duration-card border-border bg-input/30 hover:border-primary/70 peer-focus-visible:border-primary peer-focus-visible:ring-ring peer-focus-visible:ring-offset-background relative flex gap-3 cursor-pointer flex-col items-start justify-between rounded-xl border px-4 py-6 shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
								pressableClass,
								isSelected && "border-primary booking-option-surface",
							)}>
							{#if duration.badgeLabel}
								<span
									class="bg-primary text-primary-foreground absolute top-0.5 right-10 translate-x-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase shadow-sm">
									{duration.badgeLabel}
								</span>
							{/if}
							<div class="flex w-full items-center justify-between">
								<p class="text-base font-semibold leading-none">{duration.label}</p>
								<div class="flex items-end gap-1 text-right">
									{#if hasDiscount}
										<p
											class="text-muted-foreground text-xs leading-none line-through">
											{duration.originalPrice}
										</p>
									{/if}
									<p class="text-primary text-base font-semibold leading-none">
										{duration.discountedPrice}
									</p>
								</div>
							</div>
						</label>
					</div>
				{/each}
			</RadioGroup>
		</fieldset>
		{#if errors.durationValue}
			<p
				class="text-destructive text-xs"
				role="alert">
				{errors.durationValue}
			</p>
		{/if}
	</section>

	<div class="flex flex-col gap-4">
		<div class={shouldAnimateBookingButton ? "booking-cta-ready" : undefined}>
			<Button
				type="button"
				onclick={openBooking}
				class={cn(
					"h-14 w-full rounded-xl text-base font-bold tracking-wider uppercase shadow-sm",
					pressableClass,
				)}>
				{bookingStepOneContent.primaryButtonLabel}
			</Button>
		</div>
		<p class="text-muted-foreground text-sm text-pretty">
			{bookingStepOneContent.recurringPromptPrefix}
			<Button
				variant="link"
				onclick={openRecurringBooking}
				class="text-foreground decoration-primary/65 hover:text-primary p-0 underline underline-offset-4">
				{bookingStepOneContent.recurringPromptAction}
			</Button>
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
			showPostBookingNotice = false;
			if (activeModalType === "booking") {
				navigateToFinaliseBooking();
			}
			activeModalType = null;
		}} />
{/if}

<Dialog bind:open={showPostBookingNotice}>
	<DialogContent
		overlayProps={{ class: "z-10001" }}
		class="ring-red-500 z-10002 max-w-[calc(100%-1.5rem)] rounded-2xl px-6 py-4 shadow-2xl ring-2 sm:max-w-lg sm:px-8 sm:py-6"
		showCloseButton={false}>
		<DialogHeader class="gap-3">
			<DialogTitle class="text-3xl text-red-500 text-center">
				{bookingStepOneContent.postBookingNotice.title}
			</DialogTitle>
			<DialogDescription class="text-white text-sm leading-6 text-balance sm:text-base text-center">
				{bookingStepOneContent.postBookingNotice.body}
			</DialogDescription>
		</DialogHeader>
		<DialogFooter class="mt-2">
			<Button
				type="button"
				variant="outline"
				bind:ref={postBookingNoticeButtonEl}
				onclick={dismissPostBookingNotice}
				class={cn("rounded-lg w-full", pressableClass)}>
				{bookingStepOneContent.postBookingNotice.dismissLabel}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<style>
	:global(.booking-option-surface) {
		background-color: color-mix(in srgb, var(--background) 88%, var(--primary) 12%);
	}

	:global(.booking-studio-card-footer) {
		backdrop-filter: blur(2px);
	}

	:global(.booking-studio-card-footer::before) {
		content: "";
		position: absolute;
		inset: 0;
		background-color: color-mix(in srgb, var(--background) 58%, transparent);
		z-index: 0;
	}

	:global(.booking-studio-card.booking-option-surface .booking-studio-card-footer::before) {
		background-color: color-mix(
			in srgb,
			color-mix(in srgb, var(--background) 82%, var(--primary) 18%) 58%,
			transparent
		);
	}

	@media (min-width: 768px) {
		:global(.booking-studio-card-footer) {
			backdrop-filter: none;
		}

		:global(.booking-studio-card-footer::before) {
			background-color: transparent;
		}

		:global(.booking-studio-card.booking-option-surface .booking-studio-card-footer::before) {
			background-color: color-mix(
				in srgb,
				color-mix(in srgb, var(--background) 82%, var(--primary) 18%) 58%,
				transparent
			);
		}
	}

	:global(.booking-studio-card:hover .booking-studio-card-footer::before) {
		background-color: color-mix(
			in srgb,
			color-mix(in srgb, var(--background) 82%, var(--primary) 18%) 58%,
			transparent
		);
	}

	:global(.booking-duration-card:hover) {
		background-color: color-mix(in srgb, var(--background) 88%, var(--primary) 12%);
	}

	.booking-cta-ready {
		animation: booking-cta-ready 850ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@media (prefers-reduced-motion: reduce) {
		.booking-cta-ready {
			animation: none;
		}
	}

	@keyframes booking-cta-ready {
		0% {
			transform: scale(1);
		}

		30% {
			transform: scale(1.08);
		}

		52% {
			transform: scale(0.97);
		}

		72% {
			transform: scale(1.03);
		}

		100% {
			transform: scale(1);
		}
	}
</style>
