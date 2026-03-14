<script lang="ts">
	import { Calendar } from "$lib/components/ui/calendar";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
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

	/* ── Time slot data ─────────────────────────────────── */
	const timeGroups = [
		{
			label: "Morning",
			slots: [
				{ value: "07:00", label: "7:00 AM" },
				{ value: "08:00", label: "8:00 AM" },
				{ value: "09:00", label: "9:00 AM" },
				{ value: "10:00", label: "10:00 AM" },
				{ value: "11:00", label: "11:00 AM" },
			],
		},
		{
			label: "Afternoon",
			slots: [
				{ value: "12:00", label: "12:00 PM" },
				{ value: "13:00", label: "1:00 PM" },
				{ value: "14:00", label: "2:00 PM" },
				{ value: "15:00", label: "3:00 PM" },
				{ value: "16:00", label: "4:00 PM" },
			],
		},
		{
			label: "Evening",
			slots: [
				{ value: "18:00", label: "6:00 PM" },
				{ value: "19:00", label: "7:00 PM" },
				{ value: "20:00", label: "8:00 PM" },
			],
		},
	] as const;

	const durations = ["1 hr", "2 hr", "3 hr"] as const;
	const videoFormatOptions = [
		{
			value: "horizontal",
			label: "Horizontal / Widescreen",
			description: "Best for YouTube, TV, and websites",
		},
		{
			value: "vertical",
			label: "Vertical / Tall",
			description: "Best for TikTok, Instagram Reels, and Shorts",
		},
		{
			value: "both",
			label: "Both",
			description: "We need full episodes and social media clips",
		},
	] as const;
	const addOnOptions = [
		{
			value: "4k-uhd-recording",
			label: "4K UHD Recording on Cameras",
			price: "+$49",
			description: "",
		},
		{
			value: "teleprompter",
			label: "Teleprompter",
			price: "+$29",
			description: "",
		},
		{
			value: "video-editing",
			label: "Video Editing",
			price: "+$99",
			description: "Synchronising audio to video and cutting between camera angles",
		},
		{
			value: "10-social-media-clips",
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

	/* ── State ──────────────────────────────────────────── */
	let selectedDate: DateValue | undefined = $state(undefined);
	let selectedTime = $state("");
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

	/* ── Derived helpers ────────────────────────────────── */
	const dateString = $derived(
		selectedDate
			? `${selectedDate.year}-${String(selectedDate.month).padStart(2, "0")}-${String(selectedDate.day).padStart(2, "0")}`
			: "",
	);

	const durationValue = $derived(selectedDuration.replace(/[^0-9+]/g, ""));
	const selectedTimeLabel = $derived.by(() => {
		for (const group of timeGroups) {
			const match = group.slots.find((slot) => slot.value === selectedTime);
			if (match) return match.label;
		}

		return "";
	});
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
		{ label: "Time", value: selectedTimeLabel || "—" },
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

	/* ── Submit (unchanged logic) ───────────────────────── */
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
			time: selectedTimeLabel,
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
	<!-- Header -->
	<h2
		class="text-center text-2xl font-bold tracking-wide text-foreground uppercase"
	>
		Finalise Your Booking
	</h2>

	<form class="space-y-10 md:space-y-12" onsubmit={handleSubmit}>
		<!-- ── Date & Time ─────────────────────────────── -->
		<div
			class="grid items-start gap-8 md:grid-cols-[max-content_minmax(0,1fr)] md:justify-between md:gap-12"
		>
			<!-- Calendar -->
			<div class="w-fit space-y-3">
				<Label class="text-primary text-xs uppercase tracking-[0.22em]"
					>Confirm Booking Date</Label
				>
				<Calendar
					type="single"
					bind:value={selectedDate}
					minValue={minDate}
					captionLayout="dropdown"
					class="w-fit rounded-md border border-border [--cell-size:--spacing(10)]"
				/>
			</div>

			<div class="h-full space-y-8">
				<!-- Time Slots -->
				<div class="space-y-3">
					<Label class="text-primary text-xs uppercase tracking-[0.22em]"
						>Confirm Session Time</Label
					>
					<div class="space-y-5">
						{#each timeGroups as group}
							<div class="space-y-3">
								<span class="text-sm font-medium text-muted-foreground"
									>{group.label}</span
								>
								<div class="flex flex-wrap gap-3">
									{#each group.slots as slot}
										<Button
											type="button"
											variant={selectedTime === slot.value
												? "default"
												: "outline"}
											size="sm"
											onclick={() => (selectedTime = slot.value)}
										>
											{slot.label}
										</Button>
									{/each}
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Duration -->
				<div class="space-y-3">
					<Label class="text-primary text-xs uppercase tracking-[0.22em]"
						>Confirm Session Duration</Label
					>
					<div class="flex flex-wrap gap-3">
						{#each durations as dur}
							<Button
								type="button"
								variant={selectedDuration === dur ? "default" : "outline"}
								size="sm"
								onclick={() => (selectedDuration = dur)}
							>
								{dur}
							</Button>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<!-- ── Video Format ─────────────────────────────── -->
		<div class="space-y-5 pt-2">
			<fieldset class="space-y-4">
				<legend class="text-primary text-xs uppercase tracking-[0.22em]">
					Video Format
				</legend>
				<div class="grid gap-3">
					{#each videoFormatOptions as option}
						<label
							class={cn(
								"flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background px-4 py-3 text-left transition-colors",
								selectedVideoFormat === option.value && "border-primary bg-card",
							)}
						>
							<input
								type="radio"
								name="videoFormat"
								value={option.value}
								bind:group={selectedVideoFormat}
								class="mt-1 size-4 accent-primary"
							/>
							<span class="space-y-1">
								<span class="block text-sm font-medium text-foreground">
									{option.label}
								</span>
								<span class="block text-sm text-muted-foreground">
									{option.description}
								</span>
							</span>
						</label>
					{/each}
				</div>
			</fieldset>
		</div>

		<!-- ── Add-ons ──────────────────────────────────── -->
		<div class="space-y-5 pt-2">
			<fieldset class="space-y-4">
				<legend class="text-primary text-xs uppercase tracking-[0.22em]">
					Add-ons
				</legend>
				<p class="text-sm text-muted-foreground">
					Video & Audio Package includes up to 4 RODE microphones and 3 Sony
					cameras.
				</p>
				<div class="grid gap-3">
					{#each addOnOptions as option}
						<label
							class={cn(
								"flex cursor-pointer items-start gap-3 rounded-md border border-border bg-background px-4 py-3 text-left transition-colors",
								selectedAddOns.includes(option.value) && "border-primary bg-card",
							)}
						>
							<input
								type="checkbox"
								name="addOns"
								value={option.value}
								bind:group={selectedAddOns}
								class="mt-1 size-4 accent-primary"
							/>
							<span class="space-y-1">
								<span class="block text-sm font-medium text-foreground">
									{option.label} <span class="text-primary">{option.price}</span>
								</span>
								{#if option.description}
									<span class="block text-sm text-muted-foreground">
										{option.description}
									</span>
								{/if}
							</span>
						</label>
					{/each}
				</div>
			</fieldset>
		</div>


		<!-- ── Contact Information ─────────────────────── -->
		<div class="space-y-5 pt-2">
			<Label class="text-primary text-xs uppercase tracking-[0.22em]"
				>Contact Information</Label
			>
			<div class="grid gap-5 md:grid-cols-2 md:gap-6">
				<div class="space-y-1.5">
					<Label for="fullName">Full Name</Label>
					<Input
						id="fullName"
						placeholder="Awesome Artist"
						bind:value={fullName}
					/>
				</div>
				<div class="space-y-1.5">
					<Label for="phone">Contact Phone Number</Label>
					<Input
						id="phone"
						type="tel"
						placeholder="0400 000 000"
						bind:value={phone}
					/>
				</div>
			</div>
		</div>

		<!-- ── Billing Information ─────────────────────── -->
		<div class="space-y-5 pt-2">
			<Label class="text-primary text-xs uppercase tracking-[0.22em]"
				>Billing Information</Label
			>
			<div class="grid gap-5 md:grid-cols-2 md:gap-6">
				<div class="space-y-1.5">
					<Label for="accountName">Account Name</Label>
					<Input
						id="accountName"
						placeholder="Account Name"
						bind:value={accountName}
					/>
				</div>
				<div class="space-y-1.5">
					<Label for="abn">ABN</Label>
					<Input
						id="abn"
						placeholder="00 000 000 000"
						bind:value={abn}
					/>
				</div>
			</div>
			<div class="space-y-1.5">
				<Label for="invoiceEmail">Email (to receive our invoice)</Label>
				<Input
					id="invoiceEmail"
					type="email"
					placeholder="billing@example.com"
					bind:value={email}
				/>
			</div>
		</div>

		<!-- ── Questions ────────────────────────────────── -->
		<div class="space-y-5 pt-2">
			<Label
				for="questionsOrRequests"
				class="text-primary text-xs uppercase tracking-[0.22em]"
			>
				Any Questions Or Requests?
			</Label>
			<div class="space-y-3">
				<textarea
					id="questionsOrRequests"
					bind:value={questionsOrRequests}
					rows="4"
					class="border-input bg-background selection:bg-primary selection:text-primary-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 flex min-h-28 w-full rounded-md border px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px]"
					placeholder="Let us know if you have any special requests or questions."
				/>
				<p class="text-sm text-muted-foreground">
					Available for call at
					{#if contactPhone}
						<a class="text-primary hover:underline" href={`tel:${contactPhone}`}>
							{contactPhone}
						</a>
					{:else}
						0434367184
					{/if}
					{#if contactEmail}
						& email at
						<a class="text-primary hover:underline" href={`mailto:${contactEmail}`}>
							{contactEmail}
						</a>
					{:else}
						& email at contact@vertigovisuals.com.au
					{/if}
				</p>
			</div>
		</div>

		<!-- ── Summary ─────────────────────────────────── -->
		<div class="space-y-5 pt-2">
			<Label class="text-primary text-xs uppercase tracking-[0.22em]"
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

		<!-- ── Submit ──────────────────────────────────── -->
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
