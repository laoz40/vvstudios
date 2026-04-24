<script lang="ts">
	import ContactFaqItemRow from "../contact/ContactFaqItemRow.svelte";
	import { faqSectionContent } from "../../content/landing";

	export let compact = false;

	const contentSpacingClass = compact
		? "mx-auto max-w-6xl px-4 pt-8 pb-8 md:px-0 md:pt-12 md:pb-12"
		: "mx-auto max-w-6xl px-4 pt-12 pb-8 md:px-0 md:pt-16 md:pb-12";
</script>

<section
	class="bg-background w-full"
	aria-labelledby="faq-title">
	<div class={contentSpacingClass}>
		<div>
			<h2
				id="faq-title"
				class="text-3xl font-bold tracking-tight text-balance md:text-4xl">
				{faqSectionContent.title}
			</h2>
		</div>

		<div class="mt-4">
			{#each faqSectionContent.items as item}
				<ContactFaqItemRow {item} />
			{/each}
		</div>
	</div>
</section>
