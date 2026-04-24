<script lang="ts">
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import { type ContactFaqItem } from "../../content/contact";

	export type ContactFaqItemRowProps = {
		item: ContactFaqItem;
	};

	let { item }: ContactFaqItemRowProps = $props();

	let isOpen = $state(false);
</script>

<Collapsible.Root bind:open={isOpen}>
	<div class="border-b border-border last:border-b-0">
		<Collapsible.Trigger
			class="flex w-full items-start justify-between gap-4 py-5 pb-2 text-left text-lg font-semibold text-foreground transition-colors duration-150 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:items-center md:pt-6 md:pb-3">
			<span class="leading-snug">{item.question}</span>
			<ChevronDown
				class={`mt-0.5 shrink-0 transition-transform duration-200 md:mt-0 ${
					isOpen
						? "rotate-180 text-foreground"
						: "text-muted-foreground"
				}`}
				aria-hidden="true" />
		</Collapsible.Trigger>
		<Collapsible.Content class="overflow-hidden">
			<div class="max-w-5xl pb-5 text-sm text-pretty leading-7 text-muted-foreground md:pb-6 md:text-base">
				{#each item.answerParts as part}
					<div class="not-first:mt-4">
						{#if part.heading}
							<h3 class="text-sm font-medium text-foreground md:text-base">
								{part.heading}
							</h3>
						{/if}
						<p class={part.heading ? "mt-1" : ""}>{part.value}</p>
					</div>
				{/each}
			</div>
		</Collapsible.Content>
	</div>
</Collapsible.Root>
