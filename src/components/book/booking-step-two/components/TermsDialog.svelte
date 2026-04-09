<script lang="ts">
	import LoaderCircleIcon from "@lucide/svelte/icons/loader-circle";
	import { Button } from "$lib/components/ui/button";
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog";
	import type { BookingStepTwoContent } from "../../../../content/bookingTypes";

	type Props = {
		open?: boolean;
		isSubmitting: boolean;
		isSubmitted: boolean;
		termsDialogCopy: BookingStepTwoContent["termsDialog"];
		submitButtonLoading: string;
		onConfirm: () => void | Promise<void>;
	};

	let {
		open = $bindable(false),
		isSubmitting,
		isSubmitted,
		termsDialogCopy,
		submitButtonLoading,
		onConfirm,
	}: Props = $props();
</script>

<Dialog bind:open>
	<DialogContent
		class="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl p-4 sm:max-w-2xl sm:p-6"
		onInteractOutside={(event) => {
			if (isSubmitting) event.preventDefault();
		}}
		onEscapeKeydown={(event) => {
			if (isSubmitting) event.preventDefault();
		}}>
		<DialogHeader class="gap-2">
			<DialogTitle class="text-xl">{termsDialogCopy.title}</DialogTitle>
			<DialogDescription class="text-muted-foreground text-sm leading-6">
				{termsDialogCopy.description}
			</DialogDescription>
		</DialogHeader>

		<div class="bg-card space-y-4 rounded-lg border p-4 text-sm">
			{#each termsDialogCopy.items as item}
				<section class="space-y-1.5">
					<h3 class="text-foreground font-semibold">{item.title}</h3>
					<p class="text-muted-foreground leading-6">{item.body}</p>
				</section>
			{/each}
		</div>

		<DialogFooter class="flex-col gap-3 sm:flex-row sm:justify-end">
			<Button
				type="button"
				variant="outline"
				class="rounded-lg"
				disabled={isSubmitting}
				onclick={() => {
					open = false;
				}}>
				{termsDialogCopy.cancelButton}
			</Button>
			<Button
				type="button"
				class="rounded-lg"
				disabled={isSubmitting || isSubmitted}
				onclick={onConfirm}>
				{#if isSubmitting}
					<span class="flex items-center justify-center gap-2">
						<LoaderCircleIcon class="size-4 animate-spin" />
						<span>{submitButtonLoading}</span>
					</span>
				{:else}
					{termsDialogCopy.confirmButton}
				{/if}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
