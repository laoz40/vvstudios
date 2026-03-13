<script lang="ts">
	import { Popover } from "bits-ui";
	import ChevronDownIcon from "@lucide/svelte/icons/chevron-down";
	import { getLocalTimeZone, type CalendarDate } from "@internationalized/date";
	import { Calendar } from "$lib/components/ui/calendar";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Button } from "$lib/components/ui/button";
	import { cn } from "$lib/utils.js";

	type SubmittedBooking = {
		name: string;
		email: string;
		phone: string;
		date: string;
		time: string;
	};

	let name = $state("");
	let email = $state("");
	let phone = $state("");
	let time = $state("");
	let datePickerOpen = $state(false);
	let selectedDate: CalendarDate | undefined = $state();
	let submittedBooking: SubmittedBooking | null = $state(null);

	const formatDate = (date: CalendarDate | undefined) => {
		return date
			? date.toDate(getLocalTimeZone()).toLocaleDateString()
			: "Not selected";
	};

const scriptUrl = 'https://script.google.com/macros/s/AKfycbx5groIxRCnK-GcR4B2gvIGOoxwWHt8Q1VEtsUymJsCVpigBGd4g5WGThIwD4q5BRUa/exec';

	const handleSubmit = (event: SubmitEvent) => {
		event.preventDefault();

		submittedBooking = {
			name,
			email,
			phone,
			date: formatDate(selectedDate),
			time: time || "Not selected",
		};
	};
</script>

<div class="mx-auto w-full max-w-3xl">
	<form class="space-y-6" onsubmit={handleSubmit} action={scriptUrl}>
		<div class="grid gap-4 md:grid-cols-2">
			<div class="space-y-2">
				<Label for="booking-date">Date</Label>
				<Popover.Root bind:open={datePickerOpen}>
					<Popover.Trigger id="booking-date">
						{#snippet child({ props })}
							<Button
								{...props}
								variant="outline"
								class={cn(
									"w-full justify-between font-normal",
									!selectedDate && "text-muted-foreground",
								)}
							>
								{selectedDate
									? formatDate(selectedDate)
									: "Select date"}
								<ChevronDownIcon />
							</Button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content class="bg-background w-auto overflow-hidden rounded-md border p-0 shadow-md" align="start">
						<Calendar
							type="single"
							bind:value={selectedDate}
							captionLayout="dropdown"
							onValueChange={() => {
								datePickerOpen = false;
							}}
						/>
					</Popover.Content>
				</Popover.Root>
			</div>

			<div class="space-y-2">
				<Label for="time">Time</Label>
				<Input
					id="time"
					name="time"
					type="time"
					bind:value={time}
					class="bg-background appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
				/>
			</div>
		</div>

		<div class="space-y-2">
			<Label for="name">Name</Label>
			<Input id="name" name="name" bind:value={name} />
		</div>

		<div class="space-y-2">
			<Label for="email">Email</Label>
			<Input id="email" name="email" type="email" bind:value={email} />
		</div>

		<div class="space-y-2">
			<Label for="phone">Phone Number</Label>
			<Input id="phone" name="phone" type="tel" bind:value={phone} />
		</div>

		<Button type="submit">Submit</Button>
	</form>

	<div class="mt-8 space-y-2">
		<h2 class="text-lg font-semibold">Submitted Result</h2>

		{#if submittedBooking}
			<p>Name: {submittedBooking.name}</p>
			<p>Email: {submittedBooking.email}</p>
			<p>Phone: {submittedBooking.phone}</p>
			<p>Date: {submittedBooking.date}</p>
			<p>Time: {submittedBooking.time}</p>
		{:else}
			<p>No form submission yet.</p>
		{/if}
	</div>
</div>
