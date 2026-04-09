<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import {
		Dialog,
		DialogContent,
		DialogDescription,
		DialogFooter,
		DialogHeader,
		DialogTitle,
	} from "$lib/components/ui/dialog";
	import { cn } from "$lib/utils.js";
	import type { BookingStepTwoContent } from "../../../../content/bookingTypes";
	import type {
		PricingLineItem,
		SummaryItem,
		SummarySection,
	} from "./booking-types";

	type Props = {
		open?: boolean;
		isSubmitting: boolean;
		status: string;
		sectionCopy: BookingStepTwoContent["sections"];
		summaryCopy: BookingStepTwoContent["summary"];
		submittedSummarySections: SummarySection[];
		submittedPricingItems: PricingLineItem[];
		onClose: () => void;
	};

	let {
		open = $bindable(false),
		isSubmitting,
		status,
		sectionCopy,
		summaryCopy,
		submittedSummarySections,
		submittedPricingItems,
		onClose,
	}: Props = $props();

	function findItem(section: SummarySection, label: string): SummaryItem | undefined {
		return section.items.find((item) => item.label === label);
	}
</script>

<Dialog bind:open>
	<DialogContent
		class="max-h-[calc(100vh-2rem)] overflow-y-auto rounded-xl p-4 sm:max-w-lg sm:p-5"
		onInteractOutside={(event) => {
			if (isSubmitting) event.preventDefault();
		}}
		onEscapeKeydown={(event) => {
			if (isSubmitting) event.preventDefault();
		}}>
		<DialogHeader class="gap-1.5">
			<DialogTitle class="text-xl">
				{sectionCopy.statusDialogSuccessTitle}
			</DialogTitle>
			<DialogDescription class="text-muted-foreground text-sm leading-6">
				{status}
			</DialogDescription>
		</DialogHeader>

		<div class="bg-card rounded-lg border p-4 text-sm">
			{#each submittedSummarySections as section, index}
				{#if index > 0}
					<div class="border-border my-4 border-t"></div>
				{/if}
				<section class="space-y-2">
					<h3 class="text-primary text-xs font-semibold tracking-widest uppercase">
						{section.title}
					</h3>
					{#if section.title === summaryCopy.sessionDetailsTitle}
						{@const dateItem = findItem(section, summaryCopy.labels.date)}
						{@const durationItem = findItem(section, summaryCopy.labels.duration)}
						{@const formatItem = findItem(section, summaryCopy.labels.format)}
						{@const questionsItem = findItem(section, summaryCopy.labels.questions)}
						<div class="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2">
							{#each [dateItem, durationItem, formatItem, questionsItem] as item}
								{#if item}
									<dl>
										<div class="space-y-1">
											<dt class="text-muted-foreground">{item.label}</dt>
											<dd class="text-foreground leading-relaxed font-bold wrap-break-word whitespace-pre-line">
												{item.value}
											</dd>
										</div>
									</dl>
								{/if}
							{/each}
						</div>
					{:else}
						<dl class="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
							{#each section.items as item}
								<div class="space-y-1">
									<dt class="text-muted-foreground">{item.label}</dt>
									<dd class="text-foreground leading-relaxed wrap-break-word whitespace-pre-line">
										{item.value}
									</dd>
								</div>
							{/each}
						</dl>
					{/if}
				</section>
			{/each}

			<div class="border-border my-4 border-t"></div>

			<section class="space-y-2">
				<h3 class="text-primary text-xs font-semibold tracking-widest uppercase">
					{summaryCopy.paymentDueTitle}
				</h3>
				<div class="space-y-2">
					{#each submittedPricingItems as item}
						<div
							class={cn(
								"flex items-center justify-between gap-4",
								item.isAddOn && "pl-4",
								item.isTotal && "border-border pt-3 text-base font-semibold",
							)}>
							<span
								class={cn(
									item.isTotal ? "text-foreground" : "text-muted-foreground",
									item.isAddOn && "before:text-muted-foreground before:mr-2",
								)}>
								{item.label}
							</span>
							<span class="text-foreground text-right">{item.amount}</span>
						</div>
					{/each}
				</div>
				<p class="text-muted-foreground border-border mt-4 pt-3 text-xs leading-6">
					{summaryCopy.paymentDueNote}
				</p>
			</section>
		</div>

		<DialogFooter class="sm:justify-end">
			<Button
				type="button"
				variant="outline"
				class="rounded-lg"
				onclick={onClose}>
				{sectionCopy.statusDialogDismissButton}
			</Button>
		</DialogFooter>
	</DialogContent>
</Dialog>
