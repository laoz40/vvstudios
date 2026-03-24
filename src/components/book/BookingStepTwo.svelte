<script lang="ts">
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
			label: "4K UHD Recording on Cameras",
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

	let isSubmitting = $state(false);
	let status = $state("");

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

	const summaryItems = $derived([
		{ label: "Date", value: dateString || "—" },
		{ label: "Duration", value: selectedDuration || "—" },
		{ label: "Format", value: selectedVideoFormatLabel || "—" },
		{ label: "Add-ons", value: selectedAddOnLabels.join(", ") || "—" },
		{ label: "Name", value: fullName || "—" },
		{ label: "Phone", value: phone || "—" },
		{ label: "Account", value: accountName || "—" },
		{ label: "ABN", value: abn || "—" },
		{ label: "Email", value: email || "—" },
		{ label: "Requests", value: questionsOrRequests || "—" },
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

			console.log("Submitted booking payload:", payload);

			status = response.ok ? "Submitted successfully." : "Submission failed.";
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
		</div>

		<div class="space-y-6">
			<h2 class="text-foreground text-xl font-bold">
				Additional Information
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
							bind:value={email}
						/>
					</div>
				</div>
			</div>

			<!-- Questions  -->
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
						class="bg-background selection:bg-primary selection:text-primary-foreground shadow-xs"
						placeholder="Let us know if you have any special requests or questions."
					/>
					<p class="text-sm font-medium text-muted-foreground">
						Available for call at
						{#if contactPhone}
							<a class="font-bold hover:underline" href={`tel:${contactPhone}`}>
								{contactPhone}
							</a>
						{:else}
							0434367184
						{/if}
							{#if contactEmail}
								&amp; email at
							<a class="font-bold hover:underline" href={`mailto:${contactEmail}`}>
								{contactEmail}
							</a>
							{:else}
								&amp; email at contact@vertigovisuals.com.au
						{/if}
					</p>
				</div>
			</div>
		</div>

		<!-- Summary -->
		<div class="space-y-5 pt-2">
			<Label class="text-primary text-xs font-semibold tracking-widest uppercase"
				>Summary</Label
			>
			<div
				class="grid grid-cols-1 gap-x-6 gap-y-3 rounded-md border border-border bg-card/75 p-5 text-sm shadow-sm md:grid-cols-3"
			>
				{#each summaryItems as item}
					<div>
						<span class="text-muted-foreground">{item.label}</span>
						<p class="font-medium text-foreground">{item.value}</p>
					</div>
				{/each}
			</div>
		</div>

		<!-- Submit -->
		{#if status}
			<p class="text-center text-sm text-muted-foreground">{status}</p>
		{/if}
		<Button
			type="submit"
			size="lg"
			class="w-full text-base font-semibold tracking-wide uppercase"
			disabled={isSubmitting}
		>
			{isSubmitting ? "Submitting…" : "Complete Booking"}
		</Button>
	</form>
</div>
