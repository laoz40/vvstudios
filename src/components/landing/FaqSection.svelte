<script lang="ts">
	import FaqItemRow from "./FaqItemRow.svelte";
	import { faqSectionContent } from "../../content/landing";
</script>

<section
	class="bg-background w-full"
	aria-labelledby="faq-title">
	<div class="mx-auto max-w-6xl px-4 py-8 md:py-12 md:px-0">
		<div>
			<h2
				id="faq-title"
				class="text-3xl font-bold tracking-tight text-balance md:text-4xl">
				{faqSectionContent.title}
			</h2>
		</div>

		<div class="mt-4">
			{#each faqSectionContent.items as item}
				<FaqItemRow
					question={item.question}
					answer={item.answer} />
			{/each}
		</div>
	</div>
</section>
