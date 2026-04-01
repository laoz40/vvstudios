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
	import { z } from "zod";
	import { Calendar } from "$lib/components/ui/calendar";
	import { Button } from "$lib/components/ui/button";
	import { Checkbox } from "$lib/components/ui/checkbox";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";
	import { Textarea } from "$lib/components/ui/textarea";
	import { cn } from "$lib/utils.js";
	import { bookingStepTwoContent } from "../../content/booking";

	const BookingSchema = z.object({
		date: z.string().min(1, "Please select a booking date."),
		duration: z.string().min(1, "Please select a session duration."),
		videoFormat: z.string().min(1, "Please select a recording format."),
		questionsOrRequests: z
			.string()
			.trim()
			.max(200, "Please keep this under 200 characters.")
			.optional(),
		fullName: z
			.string()
			.trim()
			.min(1, "Full name is required.")
			.max(50, "Name must be 50 characters or fewer.")
			.regex(/^[\p{L}\p{M}' ,-]+$/u, "Name contains invalid characters."),
		phone: z
			.string()
			.trim()
			.min(1, "Phone number is required.")
			.regex(/^[\d\s().+\-]{6,20}$/, "Please enter a valid phone number."),
		accountName: z
			.string()
			.trim()
			.min(1, "Account name is required.")
			.max(50, "Account name must be 50 characters or fewer.")
			.regex(
				/^[\p{L}\p{M}' ,.()-]+$/u,
				"Account name contains invalid characters.",
			),
		abn: z
			.string()
			.trim()
			.min(1, "ABN is required.")
			.transform((val) => val.replace(/\s+/g, ""))
			.refine((val) => /^\d{11}$/.test(val), {
				message: "ABN must be exactly 11 digits.",
			}),
		email: z.email("Please enter a valid email address."),
	});

	type BookingErrors = Partial<
		Record<keyof z.infer<typeof BookingSchema>, string>
	>;
	type BookingField = keyof z.infer<typeof BookingSchema>;

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
	let isSubmitted = $state(false);
	let status = $state("");
	let errors: BookingErrors = $state({});

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

	const getFieldValue = (field: BookingField): string => {
		switch (field) {
			case "date":
				return dateString;
			case "duration":
				return selectedDuration;
			case "videoFormat":
				return selectedVideoFormat;
			case "questionsOrRequests":
				return questionsOrRequests;
			case "fullName":
				return fullName;
			case "phone":
				return phone;
			case "accountName":
				return accountName;
			case "abn":
				return abn;
			case "email":
				return email;
		}
	};

	const handleFieldBlur = (event: FocusEvent) => {
		const target = event.currentTarget as
			| HTMLInputElement
			| HTMLTextAreaElement
			| null;
		if (!target || !target.name) return;

		const fieldName = target.name as BookingField;
		if (!(fieldName in BookingSchema.shape)) return;

		const fieldSchema = BookingSchema.shape[fieldName];
		const result = fieldSchema.safeParse(getFieldValue(fieldName));

		if (result.success) {
			if (!errors[fieldName]) return;
			const { [fieldName]: _removed, ...rest } = errors;
			errors = rest;
			return;
		}

		errors = {
			...errors,
			[fieldName]:
				result.error.issues[0]?.message ?? "Please check this field and try again.",
		};
	};

	const handleSubmit = async (event: SubmitEvent) => {
		event.preventDefault();

		if (isSubmitted) {
			return;
		}

		if (!scriptUrl) {
			status = statusMessages.missingScriptUrl;
			return;
		}

		// Validate with Zod before submitting
		const parsed = BookingSchema.safeParse({
			date: dateString,
			duration: selectedDuration,
			videoFormat: selectedVideoFormat,
			questionsOrRequests,
			fullName,
			phone,
			accountName,
			abn,
			email,
		});

		if (!parsed.success) {
			// console.log("Failed to parse booking payload:", parsed);

			const fieldErrors: BookingErrors = {};
			for (const issue of parsed.error.issues) {
				const key = issue.path[0] as keyof BookingErrors;
				if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
			}
			errors = fieldErrors;
			isSubmitting = false;

			tick().then(() => {
				const firstError = document.querySelector('[role="alert"]');
				if (firstError) {
					firstError.scrollIntoView({ behavior: "smooth", block: "center" });
				}
			});

			return;
		}
		errors = {};

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

			console.log("Submitted booking payload:", payload);

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
				isSubmitted = true;
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
		class="space-y-10 md:space-y-14"
		onsubmit={handleSubmit}>
		<div class="space-y-6">
			<h2 class="text-foreground text-xl font-bold">
				{sectionCopy.bookingDetailsTitle}
			</h2>
			<div class="space-y-10">
				<div
					class="grid gap-8 md:grid-cols-[max-content_minmax(0,1fr)] md:items-start md:justify-between md:gap-8">
					<!-- Booking Date -->
					<div class="w-full space-y-3 md:w-fit">
						<p class="text-primary text-xs font-semibold tracking-widest">
							{sectionCopy.confirmBookingDateLabel}
						</p>
						<Calendar
							type="single"
							bind:value={selectedDate}
							minValue={minDate}
							captionLayout="dropdown"
							class="border-border w-full rounded-lg border [--cell-size:--spacing(9)] md:w-fit" />
						{#if errors.date}
							<p
								class="text-destructive text-xs"
								role="alert">
								{errors.date}
							</p>
						{/if}
					</div>

					<!-- Session Duration -->
					<div class="flex h-full flex-col gap-3">
						<fieldset class="flex flex-1 flex-col">
							<legend
								class="text-primary mb-3 text-xs font-semibold tracking-widest">
								{sectionCopy.confirmSessionDurationLabel}
							</legend>
							<RadioGroup
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
												"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 flex cursor-pointer items-center rounded-lg border px-4 py-6 text-left transition duration-500 peer-focus-visible:ring-[3px]",
												selectedDuration === option.value &&
													"border-primary bg-primary/10",
											)}>
											<div
												class="flex w-full items-center justify-between gap-3">
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
						</fieldset>
						{#if errors.duration}
							<p
								class="text-destructive text-xs"
								role="alert">
								{errors.duration}
							</p>
						{/if}
					</div>
				</div>
			</div>
		</div>

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
							class="rounded-lg"
							onclick={handleReuseLastBooking}>
							{sectionCopy.reuseSavedBookingButton}
						</Button>
					</div>
				{/if}

				<!-- Addons -->
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
											onCheckedChange={(checked) =>
												toggleAddOn(option.value, checked)}
											class="peer sr-only size-0" />
										<label
											for={`addon-${option.value}`}
											class={cn(
												"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 flex h-full min-h-40 cursor-pointer flex-col gap-4 rounded-lg border px-4 py-4 text-left transition duration-300 peer-focus-visible:ring-[3px]",
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

				<!-- Video Format -->
				<div class="space-y-5">
					<fieldset>
						<legend class="text-primary text-xs font-semibold tracking-widest">
							{sectionCopy.videoFormatLegend}
						</legend>
						<div class="mt-4">
							<RadioGroup
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
												"border-border bg-input/30 hover:border-primary hover:bg-primary/10 peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 flex min-h-28 cursor-pointer items-center justify-start gap-4 rounded-lg border px-4 py-5 text-left transition duration-500 peer-focus-visible:ring-[3px] sm:min-h-0",
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
											<div
												class="flex w-full items-center justify-between gap-3">
												<div class="flex flex-col gap-1">
													<span
														class="block text-base font-semibold text-white">
														{option.label}
													</span>
													<span
														class="text-muted-foreground block text-sm font-normal text-pretty">
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
						</div>
					</fieldset>
					{#if errors.videoFormat}
						<p
							class="text-destructive text-xs"
							role="alert">
							{errors.videoFormat}
						</p>
					{/if}
				</div>

				<!-- Questions -->
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
							onblur={handleFieldBlur}
							rows={2}
							class="bg-background selection:bg-primary selection:text-primary-foreground rounded-lg shadow-xs"
							placeholder={sectionCopy.questionsPlaceholder} />
						{#if errors.questionsOrRequests}
							<p
								class="text-destructive text-xs"
								role="alert">
								{errors.questionsOrRequests}
							</p>
						{/if}
						<p class="text-muted-foreground text-sm">
							{sectionCopy.questionsContactPrefix}
							<a
								class="text-foreground underline decoration-primary/65 underline-offset-4 transition-colors duration-150 hover:text-primary"
								href={`tel:${contactPhone}`}>
								{contactPhone}
							</a>
							{sectionCopy.questionsContactMiddle}
							<a
								class="text-foreground underline decoration-primary/65 underline-offset-4 transition-colors duration-150 hover:text-primary"
								href={`mailto:${contactEmail}`}>
								{contactEmail}
							</a>
						</p>
					</div>
				</div>
			</div>
		</div>

		<div class="space-y-6">
			<h2 class="text-foreground text-xl font-bold">
				{sectionCopy.contactBillingTitle}
			</h2>

			<div class="space-y-10">
				<!-- Contact Information -->
				<div class="space-y-5">
					<p class="text-primary text-xs font-semibold tracking-widest">
						{sectionCopy.contactInfoLabel}
					</p>
					<div class="grid gap-5 md:grid-cols-2 md:gap-6">
						<div class="space-y-1.5">
							<Label for="fullName">{sectionCopy.fullNameLabel}</Label>
							<Input
								id="fullName"
								name="fullName"
								placeholder={sectionCopy.fullNamePlaceholder}
								autocomplete="name"
								class="rounded-lg"
								bind:value={fullName}
								onblur={handleFieldBlur} />
							{#if errors.fullName}
								<p
									class="text-destructive text-xs"
									role="alert">
									{errors.fullName}
								</p>
							{/if}
						</div>
						<div class="space-y-1.5">
							<Label for="phone">{sectionCopy.phoneLabel}</Label>
							<Input
								id="phone"
								name="phone"
								type="tel"
								placeholder={sectionCopy.phonePlaceholder}
								autocomplete="tel"
								class="rounded-lg"
								bind:value={phone}
								onblur={handleFieldBlur} />
							{#if errors.phone}
								<p
									class="text-destructive text-xs"
									role="alert">
									{errors.phone}
								</p>
							{/if}
						</div>
					</div>
				</div>

				<!-- Billing Information -->
				<div class="space-y-5">
					<p class="text-primary text-xs font-semibold tracking-widest">
						{sectionCopy.billingInfoLabel}
					</p>
					<div class="grid gap-5 md:grid-cols-2 md:gap-6">
						<div class="space-y-1.5">
							<Label for="accountName">{sectionCopy.accountNameLabel}</Label>
							<Input
								id="accountName"
								name="accountName"
								placeholder={sectionCopy.accountNamePlaceholder}
								autocomplete="organization"
								class="rounded-lg"
								bind:value={accountName}
								onblur={handleFieldBlur} />
							{#if errors.accountName}
								<p
									class="text-destructive text-xs"
									role="alert">
									{errors.accountName}
								</p>
							{/if}
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
								bind:value={abn}
								onblur={handleFieldBlur} />
							{#if errors.abn}
								<p
									class="text-destructive text-xs"
									role="alert">
									{errors.abn}
								</p>
							{/if}
						</div>
					</div>
					<div class="grid gap-5 md:grid-cols-2 md:gap-6">
						<div class="space-y-1.5">
							<Label for="invoiceEmail">{sectionCopy.invoiceEmailLabel}</Label>
							<Input
								id="invoiceEmail"
								name="email"
								type="email"
								placeholder={sectionCopy.invoiceEmailPlaceholder}
								autocomplete="email"
								class="rounded-lg"
								bind:value={email}
								onblur={handleFieldBlur} />
							{#if errors.email}
								<p
									class="text-destructive text-xs"
									role="alert">
									{errors.email}
								</p>
							{/if}
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Summary -->
		<div
			class="scroll-mt-24 space-y-6 pt-2 md:scroll-mt-28"
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
											class="text-foreground leading-relaxed wrap-break-word whitespace-pre-line">
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
											class="text-foreground leading-relaxed wrap-break-word whitespace-pre-line">
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
											class="text-foreground leading-relaxed wrap-break-word whitespace-pre-line">
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
			class="h-12 w-full rounded-lg text-base font-bold tracking-wider"
			disabled={isSubmitting || isSubmitted}>
			{isSubmitted
				? sectionCopy.submitButtonSubmitted
				: isSubmitting
					? sectionCopy.submitButtonLoading
					: sectionCopy.submitButtonDefault}
		</Button>
		{#if status}
			<p
				class="text-primary text-bold text-center text-lg"
				role="status"
				aria-live="polite">
				{status}
			</p>
		{/if}
	</form>
</div>
