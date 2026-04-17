<script lang="ts">
	import { getContext, onMount } from "svelte";
	import { Button } from "$lib/components/ui/button";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import { Textarea } from "$lib/components/ui/textarea";
	import {
		BOOKING_STEP_TWO_CONTEXT,
		type BookingStepTwoContext,
	} from "../booking-store.svelte";
	import FieldError from "../components/FieldError.svelte";

	const booking = getContext<BookingStepTwoContext>(BOOKING_STEP_TWO_CONTEXT);
	const { state: bookingState, ui, actions } = booking;

	function focusTextField(id: string): void {
		document.getElementById(id)?.focus();
	}

	onMount(() => {
		const unregisterFullName = actions.registerFieldFocus("fullName", () =>
			focusTextField("fullName"),
		);
		const unregisterPhone = actions.registerFieldFocus("phone", () =>
			focusTextField("phone"),
		);
		const unregisterAccountName = actions.registerFieldFocus("accountName", () =>
			focusTextField("accountName"),
		);
		const unregisterAbn = actions.registerFieldFocus("abn", () =>
			focusTextField("abn"),
		);
		const unregisterEmail = actions.registerFieldFocus("email", () =>
			focusTextField("invoiceEmail"),
		);
		const unregisterQuestions = actions.registerFieldFocus(
			"questionsOrRequests",
			() => focusTextField("questionsOrRequests"),
		);

		return () => {
			unregisterFullName();
			unregisterPhone();
			unregisterAccountName();
			unregisterAbn();
			unregisterEmail();
			unregisterQuestions();
		};
	});
</script>

<div class="space-y-6">
	<h2 class="text-foreground text-xl font-bold">
		{ui.sectionCopy.contactBillingTitle}
	</h2>

	<div class="space-y-10">
		<div class="space-y-5">
			<p class="text-primary text-xs font-semibold tracking-widest">
				{ui.sectionCopy.contactInfoLabel}
			</p>
			<div class="grid gap-5 md:grid-cols-2 md:gap-6">
				<div class="space-y-1.5">
					<Label for="fullName">{ui.sectionCopy.fullNameLabel}</Label>
					<Input
						id="fullName"
						name="fullName"
						placeholder={ui.sectionCopy.fullNamePlaceholder}
						autocomplete="name"
						class="rounded-lg"
						bind:value={bookingState.form.fullName}
						onblur={actions.handleFieldBlur} />
					<FieldError message={bookingState.errors.fullName} />
				</div>
				<div class="space-y-1.5">
					<Label for="phone">{ui.sectionCopy.phoneLabel}</Label>
					<Input
						id="phone"
						name="phone"
						type="tel"
						placeholder={ui.sectionCopy.phonePlaceholder}
						autocomplete="tel"
						class="rounded-lg"
						bind:value={bookingState.form.phone}
						onblur={actions.handleFieldBlur} />
					<FieldError message={bookingState.errors.phone} />
				</div>
			</div>
		</div>

		<div class="space-y-5">
			<p class="text-primary text-xs font-semibold tracking-widest">
				{ui.sectionCopy.billingInfoLabel}
			</p>
			<div class="grid gap-5 md:grid-cols-2 md:gap-6">
				<div class="space-y-1.5">
					<Label for="accountName">{ui.sectionCopy.accountNameLabel}</Label>
					<Input
						id="accountName"
						name="accountName"
						placeholder={ui.sectionCopy.accountNamePlaceholder}
						autocomplete="organization"
						class="rounded-lg"
						bind:value={bookingState.form.accountName}
						onblur={actions.handleFieldBlur} />
					<FieldError message={bookingState.errors.accountName} />
				</div>
				<div class="space-y-1.5">
					<Label for="abn">{ui.sectionCopy.abnLabel}</Label>
					<Input
						id="abn"
						name="abn"
						placeholder={ui.sectionCopy.abnPlaceholder}
						inputmode="numeric"
						pattern="[0-9 ]*"
						autocomplete="on"
						class="rounded-lg"
						bind:value={bookingState.form.abn}
						onblur={actions.handleFieldBlur} />
					<FieldError message={bookingState.errors.abn} />
				</div>
			</div>
			<div class="grid gap-5 md:grid-cols-2 md:gap-6">
				<div class="space-y-1.5">
					<Label for="invoiceEmail">{ui.sectionCopy.invoiceEmailLabel}</Label>
					<Input
						id="invoiceEmail"
						name="email"
						type="email"
						placeholder={ui.sectionCopy.invoiceEmailPlaceholder}
						autocomplete="email"
						class="rounded-lg"
						bind:value={bookingState.form.email}
						onblur={actions.handleFieldBlur} />
					<FieldError message={bookingState.errors.email} />
				</div>
			</div>
			<div class="space-y-3 pt-2">
				<Label
					for="questionsOrRequests"
					class="text-primary text-xs font-semibold tracking-widest">
					{ui.sectionCopy.questionsLabel}
				</Label>
				<Textarea
					id="questionsOrRequests"
					name="questionsOrRequests"
					autocomplete="off"
					bind:value={bookingState.form.questionsOrRequests}
					onblur={actions.handleFieldBlur}
					rows={2}
					class="bg-background selection:bg-primary selection:text-primary-foreground rounded-lg shadow-xs"
					placeholder={ui.sectionCopy.questionsPlaceholder} />
				<FieldError message={bookingState.errors.questionsOrRequests} />
				<p class="text-muted-foreground text-sm">
					{ui.sectionCopy.questionsContactPrefix}
					<Button
						variant="link"
						class="text-foreground decoration-primary/65 hover:text-primary p-0 underline underline-offset-4 transition-colors duration-150"
						href={`tel:${ui.contactPhone}`}>
						{ui.contactPhone}
					</Button>
					{ui.sectionCopy.questionsContactMiddle}
					<Button
						variant="link"
						class="text-foreground decoration-primary/65 hover:text-primary p-0 underline underline-offset-4 transition-colors duration-150"
						href={`mailto:${ui.contactEmail}`}>
						{ui.contactEmail}
					</Button>
				</p>
			</div>
		</div>
	</div>
</div>
