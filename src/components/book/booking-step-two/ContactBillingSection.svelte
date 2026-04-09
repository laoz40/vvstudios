<script lang="ts">
	import { Input } from "$lib/components/ui/input";
	import { Label } from "$lib/components/ui/label";
	import type { BookingStepTwoContent } from "../../../content/bookingTypes";
	import type { BookingErrors } from "./booking-types";
	import FieldError from "./FieldError.svelte";

	type Props = {
		sectionCopy: BookingStepTwoContent["sections"];
		errors: BookingErrors;
		fullName?: string;
		phone?: string;
		accountName?: string;
		abn?: string;
		email?: string;
		onFieldBlur: (event: FocusEvent) => void;
	};

	let {
		sectionCopy,
		errors,
		fullName = $bindable(""),
		phone = $bindable(""),
		accountName = $bindable(""),
		abn = $bindable(""),
		email = $bindable(""),
		onFieldBlur,
	}: Props = $props();
</script>

<div class="space-y-6">
	<h2 class="text-foreground text-xl font-bold">
		{sectionCopy.contactBillingTitle}
	</h2>

	<div class="space-y-10">
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
						onblur={onFieldBlur} />
					<FieldError message={errors.fullName} />
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
						onblur={onFieldBlur} />
					<FieldError message={errors.phone} />
				</div>
			</div>
		</div>

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
						onblur={onFieldBlur} />
					<FieldError message={errors.accountName} />
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
						onblur={onFieldBlur} />
					<FieldError message={errors.abn} />
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
						onblur={onFieldBlur} />
					<FieldError message={errors.email} />
				</div>
			</div>
		</div>
	</div>
</div>
