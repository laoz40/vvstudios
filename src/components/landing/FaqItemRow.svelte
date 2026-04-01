<script lang="ts">
	import ChevronDown from "@lucide/svelte/icons/chevron-down";
	import * as Collapsible from "$lib/components/ui/collapsible";

	export type FaqItemRowProps = {
		question: string;
		answer: string;
	};

	let { question, answer }: FaqItemRowProps = $props();

	let isOpen = $state(false);
</script>

<Collapsible.Root bind:open={isOpen}>
	<div class="border-b border-border last:border-b-0">
		<Collapsible.Trigger
			class="flex w-full items-start justify-between gap-4 py-4 text-left text-base font-semibold text-foreground transition-colors duration-150 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:items-center md:text-lg">
			<span class="leading-snug">{question}</span>
			<ChevronDown
				class={`mt-0.5 shrink-0 transition-transform duration-200 md:mt-0 ${
					isOpen
						? "rotate-180 text-foreground"
						: "text-muted-foreground"
				}`}
				aria-hidden="true" />
		</Collapsible.Trigger>
		<Collapsible.Content class="overflow-hidden">
			<div class="max-w-4xl pb-5 text-sm text-pretty leading-7 text-muted-foreground md:pb-6 md:text-base">
				{answer}
			</div>
		</Collapsible.Content>
	</div>
</Collapsible.Root>
