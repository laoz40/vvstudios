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
	import type { BookingStepOneStudioOption } from "../../content/bookingTypes";
	import { cn } from "$lib/utils.js";
	import tableImage from "../../assets/gallery/table-setup.webp";
	import couchImage from "../../assets/couch.jpg";

	const pressableClass =
		"transform-gpu transition-[transform,border-color,background-color,color] duration-500 ease-in active:scale-99";

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
	let isBookingReady = $derived(Boolean(selectedStudioId && selectedDurationValue));
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
			return;
		}

		if (fieldErrors.durationValue) {
			durationSectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
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

		activeModalType = "booking";
		modalUrl = selectedBookingUrl;
		showBookingModal = true;
		showPostBookingNotice = true;
	}

	function openRecurringBooking() {
		openModal(recurringBookingUrl, "recurring");
	}

	function dismissPostBookingNotice() {
		showPostBookingNotice = false;
	}

	function scrollToStepTwo() {
		if (typeof document === "undefined") {
			return;
		}

		document.getElementById("booking-step-two-heading")?.scrollIntoView({
			behavior: "smooth",
			block: "start",
		});
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
<div class="space-y-10">
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
								"border-border bg-input peer-focus-visible:border-primary peer-focus-visible:ring-ring peer-focus-visible:ring-offset-background block overflow-hidden rounded-lg border transition duration-300! peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
								pressableClass,
								!isUnavailable && "hover:border-primary cursor-pointer",
								isUnavailable && "cursor-not-allowed opacity-60 saturate-0",
								selectedStudioId === studio.id && "border-primary",
							)}>
							<div class="relative h-56 w-full">
								{#if selectedStudioId === studio.id}
									<span
										class="bg-primary text-primary-foreground absolute top-3 right-3 z-10 rounded-sm px-2 py-1 text-xs font-semibold tracking-widest transition duration-300!">
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
										"bg-background/90 absolute inset-x-0 bottom-0 px-4 py-2 backdrop-blur-xs transition duration-300!",
										selectedStudioId === studio.id &&
											!isUnavailable &&
											"bg-[#393420]/90",
									)}>
									<p class="text-base font-semibold">{studio.name}</p>
									<p class="text-sm font-light text-muted-foreground text-pretty">{studio.description}</p>
								</div>
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
					{@const hasDiscount = duration.originalPrice !== duration.discountedPrice}
					<div>
						<RadioGroupItem
							id={`duration-${duration.value}`}
							value={duration.value}
							class="peer sr-only size-0" />
						<label
							for={`duration-${duration.value}`}
							class={cn(
								"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-primary peer-focus-visible:ring-ring peer-focus-visible:ring-offset-background relative flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-lg border px-4 py-2 transition duration-300! peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2",
								pressableClass,
								selectedDurationValue === duration.value &&
									"border-primary bg-primary/10",
							)}>
							{#if duration.badgeLabel}
								<span
									class="bg-primary text-primary-foreground absolute -top-2 -right-2 rounded-sm px-2 py-0.5 text-[10px] font-semibold shadow-lg">
									{duration.badgeLabel}
								</span>
							{/if}
							<p class="text-base font-semibold">{duration.label}</p>
							<div class="relative flex items-center justify-center text-sm gap-1">
								{#if hasDiscount}
									<p class="text-primary whitespace-nowrap">
										{duration.discountedPrice}
									</p>
									<p
										class="text-muted-foreground whitespace-nowrap line-through">
										{duration.originalPrice}
									</p>
								{:else}
									<p class="text-primary whitespace-nowrap">{duration.discountedPrice}</p>
								{/if}
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
					" h-12 w-full rounded-lg text-base font-bold tracking-wider",
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
				class= "text-foreground underline decoration-primary/65 underline-offset-4 hover:text-primary p-0">
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
				scrollToStepTwo();
			}
			activeModalType = null;
		}} />
{/if}

<Dialog bind:open={showPostBookingNotice}>
	<DialogContent
		overlayProps={{ class: "z-10001" }}
		onInteractOutside={(event) => event.preventDefault()}
		class="z-10002 max-w-[calc(100%-1.5rem)] rounded-2xl ring-2 ring-primary px-6 py-4 shadow-2xl sm:max-w-lg sm:px-8 sm:py-6"
		showCloseButton={false}>
		<DialogHeader class="gap-3">
			<DialogTitle class="text-xl">
				{bookingStepOneContent.postBookingNotice.title}
			</DialogTitle>
			<DialogDescription class="text-sm leading-6 text-pretty sm:text-base">
				{bookingStepOneContent.postBookingNotice.body}
			</DialogDescription>
		</DialogHeader>
		<DialogFooter class="mt-2 sm:justify-end">
			<Button
				type="button"
				bind:ref={postBookingNoticeButtonEl}
				onclick={dismissPostBookingNotice}
				class={cn("min-w-36 rounded-lg", pressableClass)}>
				{bookingStepOneContent.postBookingNotice.dismissLabel}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>

<style>
	.booking-cta-ready {
		animation: booking-cta-ready 850ms cubic-bezier(0.34, 1.56, 0.64, 1);
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
