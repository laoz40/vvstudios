<script lang="ts">
	import ContactFaqItemRow from "./ContactFaqItemRow.svelte";
	import { contactFaqItems } from "../../content/contact";
</script>

<section
	class="mx-auto mt-16 w-full max-w-2xl"
	aria-labelledby="contact-faq-title">
	<h2
		id="contact-faq-title"
		class="text-3xl font-bold tracking-tight text-balance md:text-4xl">
		Frequently Asked Questions
	</h2>

	<div class="mt-4">
		{#each contactFaqItems as item}
			<ContactFaqItemRow {item} />
		{/each}
	</div>
</section>
