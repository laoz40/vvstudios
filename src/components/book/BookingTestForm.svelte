<script lang="ts">
	import { Calendar } from "$lib/components/ui/calendar";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import {
		CalendarDate,
		today,
		getLocalTimeZone,
		type DateValue,
	} from "@internationalized/date";

	const scriptUrl =
		import.meta.env.APP_SCRIPT_URL || "";

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

	const durations = ["1 hr", "2 hr", "3 hr", "4+ hr"] as const;

	/* ── State ──────────────────────────────────────────── */
	let selectedDate: DateValue | undefined = $state(undefined);
	let selectedTime = $state("");
	let selectedDuration = $state("");

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

	const summaryItems = $derived([
		{ label: "Date", value: dateString || "—" },
		{ label: "Time", value: selectedTimeLabel || "—" },
		{ label: "Duration", value: selectedDuration || "—" },
		{ label: "Name", value: fullName || "—" },
		{ label: "Phone", value: phone || "—" },
		{ label: "Account", value: accountName || "—" },
		{ label: "ABN", value: abn || "—" },
		{ label: "Email", value: email || "—" },
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
			accountName,
			abn,
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
		Confirm Your Booking Session
	</h2>

	<form class="space-y-10 md:space-y-12" onsubmit={handleSubmit}>
		<!-- ── Date & Time ─────────────────────────────── -->
		<div
			class="grid items-start gap-8 md:grid-cols-[max-content_minmax(0,1fr)] md:justify-between md:gap-12"
		>
			<!-- Calendar -->
			<div class="w-fit space-y-3">
				<Label class="text-primary text-xs uppercase tracking-[0.22em]"
					>Booking Date</Label
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
						>Session Time</Label
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
						>Session Duration</Label
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

		<!-- ── Summary ─────────────────────────────────── -->
		<div class="space-y-5 pt-2">
			<Label class="text-primary text-xs uppercase tracking-[0.22em]"
				>Summary</Label
			>
			<div
				class="grid grid-cols-2 gap-x-6 gap-y-3 rounded-md border border-border bg-card/75 p-5 text-sm shadow-sm md:grid-cols-4"
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
