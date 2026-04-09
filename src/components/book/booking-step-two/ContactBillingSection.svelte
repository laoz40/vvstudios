<script lang="ts">
	import { getContext, onMount } from "svelte";
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import {
		BOOKING_STEP_TWO_CONTEXT,
		type BookingStepTwoContext,
	} from "./booking-store.svelte";
	import FieldError from "./FieldError.svelte";

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

		return () => {
			unregisterFullName();
			unregisterPhone();
			unregisterAccountName();
			unregisterAbn();
			unregisterEmail();
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
		</div>
	</div>
</div>
