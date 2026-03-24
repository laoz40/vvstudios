<script lang="ts">
	import { onMount, tick } from "svelte";
	import { Calendar } from "$lib/components/ui/calendar";
	import { Button } from "$lib/components/ui/button";
	import { Checkbox } from "$lib/components/ui/checkbox";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { RadioGroup, RadioGroupItem } from "$lib/components/ui/radio-group";
	import { Textarea } from "$lib/components/ui/textarea";
	import CameraIcon from "@lucide/svelte/icons/camera";
	import MonitorIcon from "@lucide/svelte/icons/monitor";
	import ScrollTextIcon from "@lucide/svelte/icons/scroll-text";
	import ScissorsIcon from "@lucide/svelte/icons/scissors";
	import SmartphoneIcon from "@lucide/svelte/icons/smartphone";
	import { cn } from "$lib/utils.js";
	import {
		today,
		getLocalTimeZone,
		type DateValue,
	} from "@internationalized/date";

	const BOOKING_STORAGE_KEY = "vvstudios.booking.step2.v1";

	const scriptUrl =
		import.meta.env.APP_SCRIPT_URL || "";
	const contactPhone = import.meta.env.APP_CONTACT_PHONE || "";
	const contactEmail = import.meta.env.APP_CONTACT_EMAIL || "";

	const durationOptions = [
		{
			value: "1 hr",
			label: "1 Hour",
			description: "Quick focused recording window",
		},
		{
			value: "2 hr",
			label: "2 Hours",
			description: "Balanced option for most projects",
		},
		{
			value: "3 hr",
			label: "3 Hours",
			description: "Extended time for deeper coverage",
		},
	] as const;
	const videoFormatOptions = [
		{
			value: "horizontal",
			icon: "monitor",
			label: "Horizontal / Widescreen",
			description: "Best for YouTube, TV, and websites",
		},
		{
			value: "vertical",
			icon: "smartphone",
			label: "Vertical / Tall",
			description: "Best for TikTok, Instagram Reels, and Shorts",
		},
		{
			value: "both",
			icon: "both",
			label: "Both",
			description: "When you need full episodes and social media clips",
		},
	] as const;
	const addOnOptions = [
		{
			value: "4k-uhd-recording",
			icon: "camera",
			label: "4K UHD Recording",
			price: "+$49",
			description: "High resolution camera capture for premium quality.",
		},
		{
			value: "teleprompter",
			icon: "scroll-text",
			label: "Teleprompter",
			price: "+$29",
			description: "On-screen script guidance for confident delivery.",
		},
		{
			value: "video-editing",
			icon: "scissors",
			label: "Video Editing",
			price: "+$99",
			description: "Synchronising audio and cutting between camera angles",
		},
		{
			value: "10-social-media-clips",
			icon: "smartphone",
			label: "10 Social Media Clips",
			price: "+$79",
			description: "With subtitles and vertical crop",
		},
	] as const;
	const addOnValues = new Set<string>(addOnOptions.map((option) => option.value));
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
		selectedAddOns = data.selectedAddOns.filter((value) => addOnValues.has(value));
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
			title: "Booking Details",
			items: [
				{ label: "Date", value: dateString || "—" },
				{ label: "Duration", value: selectedDuration || "—" },
			],
		},
		{
			title: "Session Details",
			items: [
				{ label: "Format", value: selectedVideoFormatLabel || "—" },
				{ label: "Add-ons", value: selectedAddOnLabels.join("\n") || "—" },
				{ label: "Questions or Requests", value: questionsOrRequests || "—" },
			],
		},
		{
			title: "Contact and Billing Information",
			items: [
				{ label: "Name", value: fullName || "—" },
				{ label: "Phone", value: phone || "—" },
				{ label: "Account", value: accountName || "—" },
				{ label: "ABN", value: abn || "—" },
				{ label: "Email", value: email || "—" },
			],
		},
	]);

	const handleSubmit = async (event: SubmitEvent) => {
		event.preventDefault();

		if (!scriptUrl) {
			status = "Missing script URL.";
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

			status = response.ok ? "Booking completed successfully. Check your email for your invoice." : "Booking form fail to submit.";
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
				error instanceof Error ? error.message : "Submission failed unexpectedly.";
		} finally {
			isSubmitting = false;
		}
	};

	const minDate = today(getLocalTimeZone());
</script>

<div class="mx-auto w-full max-w-4xl space-y-8">
	<form class="space-y-10 md:space-y-12" onsubmit={handleSubmit}>
		<div class="space-y-6">
			<h2 class="text-foreground text-xl font-bold">
				Booking Details
			</h2>
			<div
				class="grid gap-8 md:grid-cols-[max-content_minmax(0,1fr)] md:items-stretch md:justify-between md:gap-10"
			>
		<!-- Booking Date -->
				<div class="w-fit space-y-3">
					<Label class="text-primary text-xs font-semibold tracking-widest"
						>CONFIRM BOOKING DATE</Label
					>
					<Calendar
						type="single"
						bind:value={selectedDate}
						minValue={minDate}
						captionLayout="dropdown"
						class="w-fit border border-border [--cell-size:--spacing(9)]"
					/>
				</div>

		<!-- Session Duration -->
				<div class="space-y-3 md:h-full md:flex md:flex-col md:space-y-0 md:gap-3">
					<Label class="text-primary text-xs font-semibold tracking-widest"
						>CONFIRM SESSION DURATION</Label
					>
					<RadioGroup
						bind:value={selectedDuration}
						name="sessionDuration"
						class="grid gap-2 md:h-full md:flex-1 md:flex md:flex-col md:justify-between md:gap-0"
					>
						{#each durationOptions as option}
							<label
								class={cn(
									"flex cursor-pointer items-center border border-border bg-input/30 px-4 py-3 md:py-6 text-left transition duration-500 hover:border-primary hover:bg-primary/10",
									selectedDuration === option.value && "border-primary bg-primary/10",
								)}
							>
								<div class="flex w-full items-center justify-between gap-3">
									<span class="flex flex-col gap-1">
										<span class="block text-base font-semibold text-white">
											{option.label}
										</span>
										<span class="block text-sm font-normal text-muted-foreground">
											{option.description}
										</span>
									</span>
									<RadioGroupItem value={option.value} class="sr-only" />
									{#if selectedDuration === option.value}
										<span
											class="bg-primary text-primary-foreground px-2 py-1 text-xs font-semibold tracking-widest"
										>
											SELECTED
										</span>
									{/if}
								</div>
							</label>
						{/each}
					</RadioGroup>
				</div>
			</div>
		</div>

		{#if hasSavedBookingData}
			<div class="flex flex-row justify-between items-center border border-primary bg-card p-4">
				<p class="text-sm font-medium text-muted-foreground">
					Reuse your last saved booking information for this booking.
				</p>
				<Button
					type="button"
					variant="default"
					class="rounded-none"
					onclick={handleReuseLastBooking}
				>
					Reuse Last Booking Info
				</Button>
			</div>
		{/if}

		<div class="space-y-6">
			<h2 class="text-foreground text-xl font-bold">Session Details</h2>

			<!-- Addons -->
			<div class="space-y-5 pt-2">
				<fieldset class="space-y-4">
					<legend class="text-primary text-xs font-semibold tracking-widest">
						ADD-ONS
					</legend>
						<p class="text-sm font-medium text-muted-foreground">
							Video &amp; Audio Package includes up to 4 RODE microphones and 3 Sony cameras.
						</p>
					<div class="grid gap-3 md:grid-cols-2">
						{#each addOnOptions as option}
							<label
								class={cn(
									"flex cursor-pointer flex-col gap-3 border border-border bg-input/30 px-4 py-4 text-left transition duration-500 hover:border-primary hover:bg-primary/10",
									selectedAddOns.includes(option.value) && "border-primary bg-primary/10"
								)}
							>
								<div class="flex flex-row items-start justify-between">
									{#if option.icon === "camera"}
										<CameraIcon class="size-10 text-primary" />
									{:else if option.icon === "scroll-text"}
										<ScrollTextIcon class="size-10 text-primary" />
									{:else if option.icon === "scissors"}
										<ScissorsIcon class="size-10 text-primary" />
									{:else}
										<SmartphoneIcon class="size-10 text-primary" />
									{/if}
									<Checkbox
										name="addOns"
										value={option.value}
										checked={selectedAddOns.includes(option.value)}
										onCheckedChange={(checked) => toggleAddOn(option.value, checked)}
										class="sr-only"
									/>
									{#if selectedAddOns.includes(option.value)}
										<span
											class="bg-primary text-primary-foreground mt-1 rounded-sm px-2 py-1 text-xs font-semibold tracking-widest"
										>
											SELECTED
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
									<p class="text-sm font-normal text-muted-foreground">
										{option.description}
									</p>
								</div>
							</label>
						{/each}
					</div>
				</fieldset>
			</div>

			<!-- Video Format -->
			<div class="space-y-5 pt-2">
				<fieldset class="space-y-4">
					<legend class="text-primary font-semibold text-xs tracking-widest">
						VIDEO FORMAT
					</legend>
					<RadioGroup
						bind:value={selectedVideoFormat}
						name="videoFormat"
						class="grid gap-3"
					>
						{#each videoFormatOptions as option}
							<label
								class={cn(
									"flex justify-start cursor-pointer items-center gap-4 border border-border bg-input/30 px-4 py-4 text-left transition duration-500 hover:border-primary hover:bg-primary/10",
									selectedVideoFormat === option.value && "border-primary bg-primary/10",
								)}
							>
								{#if option.icon === "monitor"}
									<div class="flex h-7 w-11 shrink-0 items-center justify-center">
										<MonitorIcon class="size-7 text-primary" />
									</div>
								{:else if option.icon === "smartphone"}
									<div class="flex h-7 w-11 shrink-0 items-center justify-center">
										<SmartphoneIcon class="size-7 text-primary" />
									</div>
								{:else}
									<div class="flex h-7 w-11 shrink-0 items-center justify-center gap-1">
										<SmartphoneIcon class="size-5 text-primary" />
										<MonitorIcon class="size-5 text-primary" />
									</div>
								{/if}
								<div class="flex w-full items-center justify-between gap-3">
									<div class="flex flex-col gap-1">
										<span class="block text-base font-semibold text-white">
											{option.label}
										</span>
										<span class="block text-sm font-normal text-muted-foreground">
											{option.description}
										</span>
									</div>
								<RadioGroupItem value={option.value} class="sr-only" />
									{#if selectedVideoFormat === option.value}
										<span
											class="bg-primary text-primary-foreground px-2 py-1 text-xs font-semibold tracking-widest"
										>
											SELECTED
										</span>
									{/if}
								</div>
							</label>
						{/each}
					</RadioGroup>
				</fieldset>
			</div>

			<!-- Questions -->
			<div class="space-y-5 pt-2">
				<Label
					for="questionsOrRequests"
					class="text-primary text-xs font-semibold tracking-widest"
				>
					ANY QUESTIONS OR REQUESTS?
				</Label>
				<div class="space-y-3">
					<Textarea
						id="questionsOrRequests"
						autocomplete="off"
						bind:value={questionsOrRequests}
						rows={2}
						class="rounded-none bg-background selection:bg-primary selection:text-primary-foreground shadow-xs"
						placeholder="Let us know if you have any special requests or questions."
					/>
					<p class="text-sm font-medium text-muted-foreground">
						Available for call at
							<a class="font-semibold hover:underline" href={`tel:${contactPhone}`}>
								{contactPhone}
							</a>
								&amp; email at
							<a class="font-semibold hover:underline" href={`mailto:${contactEmail}`}>
								{contactEmail}
							</a>
					</p>
				</div>
			</div>
		</div>

		<div class="space-y-6">
			<h2 class="text-foreground text-xl font-bold">
				CONTACT AND BILLING INFORMATION
			</h2>

			<!-- Contact Information -->
			<div class="space-y-5 pt-2">
				<Label class="text-primary text-xs font-semibold tracking-widest"
					>CONTACT INFORMATION</Label
				>
				<div class="grid gap-5 md:grid-cols-2 md:gap-6">
					<div class="space-y-1.5">
						<Label for="fullName">Full Name</Label>
						<Input
							id="fullName"
							placeholder="Awesome Artist"
							autocomplete="name"
							class="rounded-none"
							bind:value={fullName}
						/>
					</div>
					<div class="space-y-1.5">
						<Label for="phone">Contact Phone Number</Label>
						<Input
							id="phone"
							type="tel"
							placeholder="0400 000 000"
							autocomplete="tel"
							class="rounded-none"
							bind:value={phone}
						/>
					</div>
				</div>
			</div>

			<!-- Billing Information -->
			<div class="space-y-5 pt-2">
				<Label class="text-primary text-xs font-semibold tracking-widest"
					>BILLING INFORMATION</Label
				>
				<div class="grid gap-5 md:grid-cols-2 md:gap-6">
					<div class="space-y-1.5">
						<Label for="accountName">Account Name</Label>
						<Input
							id="accountName"
							placeholder="Account Name"
							autocomplete="organization"
							class="rounded-none"
							bind:value={accountName}
						/>
					</div>
					<div class="space-y-1.5">
						<Label for="abn">ABN</Label>
						<Input
							id="abn"
							name="abn"
							placeholder="00 000 000 000"
							inputmode="numeric"
							pattern="[0-9 ]*"
							autocomplete="on"
							class="rounded-none"
							bind:value={abn}
						/>
					</div>
				</div>
				<div class="grid gap-5 md:grid-cols-2 md:gap-6">
					<div class="space-y-1.5">
						<Label for="invoiceEmail">Email (to receive your invoice)</Label>
						<Input
							id="invoiceEmail"
							type="email"
							placeholder="billing@example.com"
							autocomplete="email"
							class="rounded-none"
							bind:value={email}
						/>
					</div>
				</div>
			</div>

		</div>

		<!-- Summary -->
		<div
			class="space-y-5 pt-2 scroll-mt-24 md:scroll-mt-28"
			bind:this={summarySectionEl}
		>
			<Label class="text-primary text-xs font-semibold tracking-widest uppercase"
				>Summary</Label
			>
			<div class="rounded-none border border-border bg-background p-5 text-sm shadow-sm">
				{#each summarySections as section, index}
					{#if index > 0}
						<div class="my-5 border-t border-border"></div>
					{/if}
					<section class="space-y-3">
						<h3
							class="text-white text-xs font-semibold tracking-widest uppercase"
						>
							{section.title}
						</h3>
						{#if section.title === "Contact and Billing Information"}
							<dl class="grid grid-cols-1 gap-3 md:grid-cols-3">
								{#each section.items.slice(0, 2) as item}
									<div class="space-y-1">
										<dt class="text-muted-foreground">{item.label}</dt>
										<dd
											class="text-foreground wrap-break-word font-medium leading-relaxed whitespace-pre-line"
										>
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
											class="text-foreground wrap-break-word font-medium leading-relaxed whitespace-pre-line"
										>
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
											class="text-foreground wrap-break-word font-medium leading-relaxed whitespace-pre-line"
										>
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
			<Checkbox id="saveBookingInfo" bind:checked={saveBookingInfo} class="rounded-none" />
			<Label for="saveBookingInfo" class="text-sm leading-relaxed text-muted-foreground">
				Save booking information to this device for next time
			</Label>
		</div>
		</div>


		<!-- Submit -->
		<Button
			type="submit"
			size="lg"
			class="h-12 w-full rounded-none text-base font-extrabold tracking-wider"
			disabled={isSubmitting}
		>
			{isSubmitting ? "SUBMITTING…" : "COMPLETE BOOKING"}
		</Button>
		{#if status}
			<p class="text-primary text-bold text-center text-lg">{status}</p>
		{/if}
	</form>
</div>
