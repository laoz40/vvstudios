<script lang="ts">
	import { onMount, tick } from "svelte";
	import {
		today,
		getLocalTimeZone,
		type DateValue,
	} from "@internationalized/date";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import MonitorIcon from "@lucide/svelte/icons/monitor";
	import ScrollTextIcon from "@lucide/svelte/icons/scroll-text";
	import ScissorsIcon from "@lucide/svelte/icons/scissors";
	import SmartphoneIcon from "@lucide/svelte/icons/smartphone";
	import { Calendar } from "$lib/components/ui/calendar";
	import { Button } from "$lib/components/ui/button";
	import { Checkbox } from "$lib/components/ui/checkbox";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";
	import { Textarea } from "$lib/components/ui/textarea";
	import { cn } from "$lib/utils.js";
	import { bookingStepTwoContent } from "../../content/booking";

	const BOOKING_STORAGE_KEY = "vvstudios.booking.step2.v1";

	const durationOptions = bookingStepTwoContent.durationOptions;
	const videoFormatOptions = bookingStepTwoContent.videoFormatOptions;
	const addOnOptions = bookingStepTwoContent.addOnOptions;
	const scriptUrl = bookingStepTwoContent.scriptUrl;
	const contactPhone = bookingStepTwoContent.contact.phone;
	const contactEmail = bookingStepTwoContent.contact.email;
	const statusMessages = bookingStepTwoContent.statusMessages;
	const sectionCopy = bookingStepTwoContent.sections;
	const summaryCopy = bookingStepTwoContent.summary;
	const addOnValues = new Set<string>(
		addOnOptions.map((option) => option.value),
	);
	const videoFormatValues = new Set<string>(
		videoFormatOptions.map((option) => option.value),
	);

	type PersistedBookingData = {
		selectedAddOns: string[];
		selectedVideoFormat: string;
		questionsOrRequests: string;
		fullName: string;
		phone: string;
		accountName: string;
		abn: string;
		email: string;
	};

	type PersistedBookingEnvelope = {
		version: 1;
		updatedAt: string;
		data: PersistedBookingData;
	};
	const toAddOnFieldName = (value: string) =>
		`addOn${value
			.split("-")
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join("")}`;
	const toggleAddOn = (value: string, checked: boolean) => {
		selectedAddOns = checked
			? [...selectedAddOns, value]
			: selectedAddOns.filter((item) => item !== value);
	};

	let selectedDate: DateValue | undefined = $state(undefined);
	let selectedDuration = $state("");
	let selectedVideoFormat = $state("");
	let selectedAddOns: string[] = $state([]);
	let questionsOrRequests = $state("");

	let fullName = $state("");
	let phone = $state("");
	let accountName = $state("");
	let abn = $state("");
	let email = $state("");
	let saveBookingInfo = $state(false);
	let hasSavedBookingData = $state(false);
	let summarySectionEl: HTMLDivElement | undefined = $state(undefined);

	let isSubmitting = $state(false);
	let status = $state("");

	const isStringArray = (value: unknown): value is string[] =>
		Array.isArray(value) && value.every((item) => typeof item === "string");
	const isPersistedBookingData = (
		value: unknown,
	): value is PersistedBookingData => {
		if (!value || typeof value !== "object") return false;
		const data = value as Record<string, unknown>;
		return (
			isStringArray(data.selectedAddOns) &&
			typeof data.selectedVideoFormat === "string" &&
			typeof data.questionsOrRequests === "string" &&
			typeof data.fullName === "string" &&
			typeof data.phone === "string" &&
			typeof data.accountName === "string" &&
			typeof data.abn === "string" &&
			typeof data.email === "string"
		);
	};
	const readStoredBooking = (): PersistedBookingEnvelope | null => {
		if (typeof window === "undefined") return null;
		const raw = window.localStorage.getItem(BOOKING_STORAGE_KEY);
		if (!raw) return null;

		try {
			const parsed = JSON.parse(raw) as unknown;
			if (!parsed || typeof parsed !== "object") return null;
			const envelope = parsed as Record<string, unknown>;
			if (
				envelope.version !== 1 ||
				typeof envelope.updatedAt !== "string" ||
				!isPersistedBookingData(envelope.data)
			) {
				return null;
			}
			return {
				version: 1,
				updatedAt: envelope.updatedAt,
				data: envelope.data,
			};
		} catch {
			return null;
		}
	};
	const writeStoredBooking = (data: PersistedBookingData) => {
		if (typeof window === "undefined") return;
		const envelope: PersistedBookingEnvelope = {
			version: 1,
			updatedAt: new Date().toISOString(),
			data,
		};
		window.localStorage.setItem(BOOKING_STORAGE_KEY, JSON.stringify(envelope));
	};
	const applyStoredBooking = (data: PersistedBookingData) => {
		selectedAddOns = data.selectedAddOns.filter((value) =>
			addOnValues.has(value),
		);
		selectedVideoFormat = videoFormatValues.has(data.selectedVideoFormat)
			? data.selectedVideoFormat
			: "";
		questionsOrRequests = data.questionsOrRequests;
		fullName = data.fullName;
		phone = data.phone;
		accountName = data.accountName;
		abn = data.abn;
		email = data.email;
	};
	const handleReuseLastBooking = async () => {
		const stored = readStoredBooking();
		if (!stored) return;
		applyStoredBooking(stored.data);
		await tick();
		summarySectionEl?.scrollIntoView({ behavior: "smooth", block: "start" });
	};
	const resetFormState = () => {
		selectedDate = undefined;
		selectedDuration = "";
		selectedVideoFormat = "";
		selectedAddOns = [];
		questionsOrRequests = "";
		fullName = "";
		phone = "";
		accountName = "";
		abn = "";
		email = "";
		saveBookingInfo = false;
	};

	onMount(() => {
		const stored = readStoredBooking();
		if (!stored) return;
		hasSavedBookingData = true;
		saveBookingInfo = true;
	});

	// Derived helpers
	const dateString = $derived(
		selectedDate
			? `${selectedDate.year}-${String(selectedDate.month).padStart(2, "0")}-${String(selectedDate.day).padStart(2, "0")}`
			: "",
	);

	const durationValue = $derived(selectedDuration.replace(/[^0-9+]/g, ""));
	const selectedVideoFormatLabel = $derived.by(() => {
		const match = videoFormatOptions.find(
			(option) => option.value === selectedVideoFormat,
		);
		return match?.label || "";
	});
	const selectedAddOnLabels = $derived.by(() =>
		addOnOptions
			.filter((option) => selectedAddOns.includes(option.value))
			.map((option) => `${option.label} (${option.price})`),
	);
	const selectedAddOnFields = $derived.by(() =>
		Object.fromEntries(
			addOnOptions.map((option) => [
				toAddOnFieldName(option.value),
				selectedAddOns.includes(option.value),
			]),
		),
	);

	const summarySections = $derived([
		{
			title: summaryCopy.bookingDetailsTitle,
			items: [
				{
					label: summaryCopy.labels.date,
					value: dateString || summaryCopy.emptyValue,
				},
				{
					label: summaryCopy.labels.duration,
					value: selectedDuration || summaryCopy.emptyValue,
				},
			],
		},
		{
			title: summaryCopy.sessionDetailsTitle,
			items: [
				{
					label: summaryCopy.labels.format,
					value: selectedVideoFormatLabel || summaryCopy.emptyValue,
				},
				{
					label: summaryCopy.labels.addOns,
					value: selectedAddOnLabels.join("\n") || summaryCopy.emptyValue,
				},
				{
					label: summaryCopy.labels.questions,
					value: questionsOrRequests || summaryCopy.emptyValue,
				},
			],
		},
		{
			title: summaryCopy.contactBillingTitle,
			items: [
				{
					label: summaryCopy.labels.name,
					value: fullName || summaryCopy.emptyValue,
				},
				{
					label: summaryCopy.labels.phone,
					value: phone || summaryCopy.emptyValue,
				},
				{
					label: summaryCopy.labels.account,
					value: accountName || summaryCopy.emptyValue,
				},
				{ label: summaryCopy.labels.abn, value: abn || summaryCopy.emptyValue },
				{
					label: summaryCopy.labels.email,
					value: email || summaryCopy.emptyValue,
				},
			],
		},
	]);

	const handleSubmit = async (event: SubmitEvent) => {
		event.preventDefault();

		if (!scriptUrl) {
			status = statusMessages.missingScriptUrl;
			return;
		}

		isSubmitting = true;
		status = "";

		const payload = {
			name: fullName,
			email,
			phone,
			date: dateString,
			duration: durationValue,
			videoFormat: selectedVideoFormatLabel,
			...selectedAddOnFields,
			accountName,
			abn,
			questionsOrRequests,
		};

		try {
			const response = await fetch(scriptUrl, {
				method: "POST",
				redirect: "follow",
				headers: {
					"Content-Type": "text/plain;charset=utf-8",
				},
				body: JSON.stringify(payload),
			});

			// console.log("Submitted booking payload:", payload);

			status = response.ok
				? statusMessages.success
				: statusMessages.submitFailed;
			if (response.ok && saveBookingInfo) {
				writeStoredBooking({
					selectedAddOns,
					selectedVideoFormat,
					questionsOrRequests,
					fullName,
					phone,
					accountName,
					abn,
					email,
				});
				hasSavedBookingData = true;
			}
			if (response.ok) {
				resetFormState();
			}
		} catch (error) {
			status =
				error instanceof Error
					? error.message
					: statusMessages.submitUnexpectedlyFailed;
		} finally {
			isSubmitting = false;
		}
	};

	const minDate = today(getLocalTimeZone());
</script>

<div class="mx-auto w-full max-w-4xl space-y-8">
	<form
		class="space-y-10 md:space-y-12"
		onsubmit={handleSubmit}>
		<div class="space-y-6">
			<h2 class="text-foreground text-xl font-bold">
				{sectionCopy.bookingDetailsTitle}
			</h2>
			<div
				class="grid gap-8 md:grid-cols-[max-content_minmax(0,1fr)] md:items-stretch md:justify-between md:gap-10">
				<!-- Booking Date -->
				<div class="w-fit space-y-3">
					<Label class="text-primary text-xs font-semibold tracking-widest"
						>{sectionCopy.confirmBookingDateLabel}</Label>
					<Calendar
						type="single"
						bind:value={selectedDate}
						minValue={minDate}
						captionLayout="dropdown"
						class="border-border w-fit rounded-lg border [--cell-size:--spacing(9)]" />
				</div>

				<!-- Session Duration -->
				<div
					class="space-y-3 md:flex md:h-full md:flex-col md:gap-3 md:space-y-0">
					<Label class="text-primary text-xs font-semibold tracking-widest"
						>{sectionCopy.confirmSessionDurationLabel}</Label>
					<RadioGroup
						bind:value={selectedDuration}
						name="sessionDuration"
						class="grid gap-2 md:flex md:h-full md:flex-1 md:flex-col md:justify-between md:gap-0">
						{#each durationOptions as option}
							<div>
								<RadioGroupItem
									id={`session-duration-${option.value}`}
									value={option.value}
									class="peer sr-only" />
								<label
									for={`session-duration-${option.value}`}
									class={cn(
										"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 flex cursor-pointer items-center rounded-lg border px-4 py-3 text-left transition duration-500 peer-focus-visible:ring-[3px] md:py-6",
										selectedDuration === option.value &&
											"border-primary bg-primary/10",
									)}>
									<div class="flex w-full items-center justify-between gap-3">
										<span class="flex flex-col gap-1">
											<span class="block text-base font-semibold">
												{option.label}
											</span>
											<span
												class="text-muted-foreground block text-sm font-normal">
												{option.description}
											</span>
										</span>
										{#if selectedDuration === option.value}
											<span
												class="bg-primary text-primary-foreground rounded-sm px-2 py-1 text-xs font-semibold tracking-widest">
												{sectionCopy.selectedBadge}
											</span>
										{/if}
									</div>
								</label>
							</div>
						{/each}
					</RadioGroup>
				</div>
			</div>
		</div>

		<div class="space-y-6">
			<h2 class="text-foreground text-xl font-bold">
				{sectionCopy.sessionDetailsTitle}
			</h2>

			<!-- Addons -->
			<div class="space-y-5 pt-2">
				{#if hasSavedBookingData}
					<div
						class="border-primary bg-input/30 mb-8 flex flex-row items-center justify-between rounded-lg border p-4">
						<p class="text-muted-foreground text-sm font-medium">
							{sectionCopy.reuseSavedBookingText}
						</p>
						<Button
							type="button"
							variant="default"
							class="rounded-lg"
							onclick={handleReuseLastBooking}>
							{sectionCopy.reuseSavedBookingButton}
						</Button>
					</div>
				{/if}

				<fieldset class="space-y-4">
					<legend class="text-primary text-xs font-semibold tracking-widest">
						{sectionCopy.addOnsLegend}
					</legend>
					<p class="text-muted-foreground text-sm font-medium">
						{sectionCopy.addOnsHelper}
					</p>
					<div class="grid gap-3 md:grid-cols-2">
						{#each addOnOptions as option}
							<div class="h-full">
								<Checkbox
									id={`addon-${option.value}`}
									name="addOns"
									value={option.value}
									checked={selectedAddOns.includes(option.value)}
									onCheckedChange={(checked) =>
										toggleAddOn(option.value, checked)}
									class="peer sr-only" />
								<label
									for={`addon-${option.value}`}
									class={cn(
										"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 flex h-full min-h-40 cursor-pointer flex-col gap-3 rounded-lg border px-4 py-4 text-left transition duration-300 peer-focus-visible:ring-[3px]",
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
											<span
												class="bg-primary text-primary-foreground mt-1 rounded-sm px-2 py-1 text-xs font-semibold tracking-widest">
												{sectionCopy.selectedBadge}
											</span>
										{/if}
									</div>
									<div class="flex flex-col gap-1.5">
										<div class="flex items-start justify-between gap-4">
											<span class="text-base font-semibold text-white">
												{option.label}
											</span>
											<span class="text-primary text-base font-medium">
												{option.price}
											</span>
										</div>
										<p class="text-muted-foreground text-sm font-normal">
											{option.description}
										</p>
									</div>
								</label>
							</div>
						{/each}
					</div>
				</fieldset>
			</div>

			<!-- Video Format -->
			<div class="space-y-5 pt-2">
				<fieldset class="space-y-4">
					<legend class="text-primary text-xs font-semibold tracking-widest">
						{sectionCopy.videoFormatLegend}
					</legend>
					<RadioGroup
						bind:value={selectedVideoFormat}
						name="videoFormat"
						class="grid gap-3">
						{#each videoFormatOptions as option}
							<div>
								<RadioGroupItem
									id={`video-format-${option.value}`}
									value={option.value}
									class="peer sr-only" />
								<label
									for={`video-format-${option.value}`}
									class={cn(
										"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 flex cursor-pointer items-center justify-start gap-4 rounded-lg border px-4 py-4 text-left transition duration-500 peer-focus-visible:ring-[3px]",
										selectedVideoFormat === option.value &&
											"border-primary bg-primary/10",
									)}>
									{#if option.icon === "monitor"}
										<div
											class="flex h-7 w-11 shrink-0 items-center justify-center">
											<MonitorIcon class="text-primary size-7" />
										</div>
									{:else if option.icon === "smartphone"}
										<div
											class="flex h-7 w-11 shrink-0 items-center justify-center">
											<SmartphoneIcon class="text-primary size-7" />
										</div>
									{:else}
										<div
											class="flex h-7 w-11 shrink-0 items-center justify-center gap-1">
											<SmartphoneIcon class="text-primary size-5" />
											<MonitorIcon class="text-primary size-5" />
										</div>
									{/if}
									<div class="flex w-full items-center justify-between gap-3">
										<div class="flex flex-col gap-1">
											<span class="block text-base font-semibold text-white">
												{option.label}
											</span>
											<span
												class="text-muted-foreground block text-sm font-normal">
												{option.description}
											</span>
										</div>
										{#if selectedVideoFormat === option.value}
											<span
												class="bg-primary text-primary-foreground rounded-sm px-2 py-1 text-xs font-semibold tracking-widest">
												{sectionCopy.selectedBadge}
											</span>
										{/if}
									</div>
								</label>
							</div>
						{/each}
					</RadioGroup>
				</fieldset>
			</div>

			<!-- Questions -->
			<div class="space-y-5 pt-2">
				<Label
					for="questionsOrRequests"
					class="text-primary text-xs font-semibold tracking-widest">
					{sectionCopy.questionsLabel}
				</Label>
				<div class="space-y-3">
					<Textarea
						id="questionsOrRequests"
						autocomplete="off"
						bind:value={questionsOrRequests}
						rows={2}
						class="bg-background selection:bg-primary selection:text-primary-foreground rounded-lg shadow-xs"
						placeholder={sectionCopy.questionsPlaceholder} />
					<p class="text-muted-foreground text-sm font-medium">
						{sectionCopy.questionsContactPrefix}
						<a
							class="font-semibold hover:underline"
							href={`tel:${contactPhone}`}>
							{contactPhone}
						</a>
						{sectionCopy.questionsContactMiddle}
						<a
							class="font-semibold hover:underline"
							href={`mailto:${contactEmail}`}>
							{contactEmail}
						</a>
					</p>
				</div>
			</div>
		</div>

		<div class="space-y-6">
			<h2 class="text-foreground text-xl font-bold">
				{sectionCopy.contactBillingTitle}
			</h2>

			<!-- Contact Information -->
			<div class="space-y-5 pt-2">
				<Label class="text-primary text-xs font-semibold tracking-widest"
					>{sectionCopy.contactInfoLabel}</Label>
				<div class="grid gap-5 md:grid-cols-2 md:gap-6">
					<div class="space-y-1.5">
						<Label for="fullName">{sectionCopy.fullNameLabel}</Label>
						<Input
							id="fullName"
							placeholder={sectionCopy.fullNamePlaceholder}
							autocomplete="name"
							class="rounded-lg"
							bind:value={fullName} />
					</div>
					<div class="space-y-1.5">
						<Label for="phone">{sectionCopy.phoneLabel}</Label>
						<Input
							id="phone"
							type="tel"
							placeholder={sectionCopy.phonePlaceholder}
							autocomplete="tel"
							class="rounded-lg"
							bind:value={phone} />
					</div>
				</div>
			</div>

			<!-- Billing Information -->
			<div class="space-y-5 pt-2">
				<Label class="text-primary text-xs font-semibold tracking-widest"
					>{sectionCopy.billingInfoLabel}</Label>
				<div class="grid gap-5 md:grid-cols-2 md:gap-6">
					<div class="space-y-1.5">
						<Label for="accountName">{sectionCopy.accountNameLabel}</Label>
						<Input
							id="accountName"
							placeholder={sectionCopy.accountNamePlaceholder}
							autocomplete="organization"
							class="rounded-lg"
							bind:value={accountName} />
					</div>
					<div class="space-y-1.5">
						<Label for="abn">{sectionCopy.abnLabel}</Label>
						<Input
							id="abn"
							name="abn"
							placeholder={sectionCopy.abnPlaceholder}
							inputmode="numeric"
							pattern="[0-9 ]*"
							autocomplete="on"
							class="rounded-lg"
							bind:value={abn} />
					</div>
				</div>
				<div class="grid gap-5 md:grid-cols-2 md:gap-6">
					<div class="space-y-1.5">
						<Label for="invoiceEmail">{sectionCopy.invoiceEmailLabel}</Label>
						<Input
							id="invoiceEmail"
							type="email"
							placeholder={sectionCopy.invoiceEmailPlaceholder}
							autocomplete="email"
							class="rounded-lg"
							bind:value={email} />
					</div>
				</div>
			</div>
		</div>

		<!-- Summary -->
		<div
			class="scroll-mt-24 space-y-5 pt-2 md:scroll-mt-28"
			bind:this={summarySectionEl}>
			<h2 class="text-foreground text-xl font-bold">
				{sectionCopy.summaryLabel}
			</h2>
			<div
				class="border-border bg-background rounded-lg border p-5 text-sm shadow-sm">
				{#each summarySections as section, index}
					{#if index > 0}
						<div class="border-border my-5 border-t"></div>
					{/if}
					<section class="space-y-3">
						<h3
							class="text-xs font-semibold tracking-widest text-white uppercase">
							{section.title}
						</h3>
						{#if section.title === summaryCopy.contactBillingTitle}
							<dl class="grid grid-cols-1 gap-3 md:grid-cols-3">
								{#each section.items.slice(0, 2) as item}
									<div class="space-y-1">
										<dt class="text-muted-foreground">{item.label}</dt>
										<dd
											class="text-foreground leading-relaxed font-medium wrap-break-word whitespace-pre-line">
											{item.value}
										</dd>
									</div>
								{/each}
							</dl>
							<dl class="grid grid-cols-1 gap-3 md:grid-cols-3">
								{#each section.items.slice(2) as item}
									<div class="space-y-1">
										<dt class="text-muted-foreground">{item.label}</dt>
										<dd
											class="text-foreground leading-relaxed font-medium wrap-break-word whitespace-pre-line">
											{item.value}
										</dd>
									</div>
								{/each}
							</dl>
						{:else}
							<dl class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
								{#each section.items as item}
									<div class="space-y-1">
										<dt class="text-muted-foreground">{item.label}</dt>
										<dd
											class="text-foreground leading-relaxed font-medium wrap-break-word whitespace-pre-line">
											{item.value}
										</dd>
									</div>
								{/each}
							</dl>
						{/if}
					</section>
				{/each}
			</div>
			<div class="flex items-center gap-3">
				<Checkbox
					id="saveBookingInfo"
					bind:checked={saveBookingInfo}
					class="rounded-sm" />
				<Label
					for="saveBookingInfo"
					class="text-muted-foreground cursor-pointer text-sm leading-relaxed">
					{sectionCopy.saveBookingInfoLabel}
				</Label>
			</div>
		</div>

		<!-- Submit -->
		<Button
			type="submit"
			size="lg"
			class="h-12 w-full rounded-lg text-base font-extrabold tracking-wider"
			disabled={isSubmitting}>
			{isSubmitting
				? sectionCopy.submitButtonLoading
				: sectionCopy.submitButtonDefault}
		</Button>
		{#if status}
			<p class="text-primary text-bold text-center text-lg">{status}</p>
		{/if}
	</form>
</div>
