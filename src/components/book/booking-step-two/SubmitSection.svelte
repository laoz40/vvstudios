<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { Checkbox } from "$lib/components/ui/checkbox";
	import { Label } from "$lib/components/ui/label";
	import { cn } from "$lib/utils.js";
	import type { BookingStepTwoContent } from "../../../content/bookingTypes";

	type Props = {
		sectionCopy: BookingStepTwoContent["sections"];
		pressableClass: string;
		submitButtonLabel: string;
		isSubmitting: boolean;
		isSubmitted: boolean;
		saveBookingInfo?: boolean;
		completeBookingSection?: HTMLDivElement | null;
	};

	let {
		sectionCopy,
		pressableClass,
		submitButtonLabel,
		isSubmitting,
		isSubmitted,
		saveBookingInfo = $bindable(false),
		completeBookingSection = $bindable(null),
	}: Props = $props();
</script>

<div
	class="space-y-6"
	bind:this={completeBookingSection}>
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

	<Button
		type="submit"
		size="lg"
		class={cn(
			"h-12 w-full rounded-lg text-base font-bold tracking-wider",
			pressableClass,
		)}
		disabled={isSubmitting || isSubmitted}>
		{submitButtonLabel}
	</Button>
</div>
