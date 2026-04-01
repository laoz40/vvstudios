<script lang="ts">
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import * as Collapsible from "$lib/components/ui/collapsible";
	import {
		contactEmail,
		contactPhone,
		type ContactFaqItem,
	} from "../../content/contact";

	export type ContactFaqItemRowProps = {
		item: ContactFaqItem;
	};

	let { item }: ContactFaqItemRowProps = $props();

	let isOpen = $state(false);
</script>

<Collapsible.Root bind:open={isOpen}>
	<div class="border-b border-border last:border-b-0">
		<Collapsible.Trigger
			class="flex w-full items-start justify-between gap-4 py-5 text-left text-base font-semibold text-foreground transition-colors duration-150 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:items-center md:py-6">
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
			<div class="max-w-2xl pb-5 text-sm leading-7 text-muted-foreground md:pb-6 md:text-base">
				{#each item.answerParts as part}
					{#if part.type === "text"}
						{part.value}
					{:else if part.type === "email"}
						<a
							href={`mailto:${contactEmail}`}
							class="text-foreground underline decoration-primary/65 underline-offset-4 transition-colors duration-150 hover:text-primary">
							{contactEmail}
						</a>
					{:else}
						<a
							href={`tel:${contactPhone}`}
							class="text-foreground underline decoration-primary/65 underline-offset-4 transition-colors duration-150 hover:text-primary">
							{contactPhone}
						</a>
					{/if}
				{/each}
			</div>
		</Collapsible.Content>
	</div>
</Collapsible.Root>
