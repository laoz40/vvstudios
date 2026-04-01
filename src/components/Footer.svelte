<script lang="ts">
	import { contactItems } from "../content/contact";
	import { footerContent } from "../content/footer";

	const currentYear = new Date().toLocaleDateString(undefined, {
		year: "numeric",
	});
</script>

<footer class="border-border border-t px-4 py-10 sm:py-12">
	<div class="mx-auto flex w-full max-w-6xl flex-col gap-6">
		<div
			class="flex flex-col gap-5 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
			<div class="space-y-2">
				<p class="text-foreground text-xl font-black tracking-wide">
					{footerContent.studioName}
				</p>
				<p class="text-muted-foreground max-w-md text-sm leading-relaxed">
					{footerContent.lead}
				</p>
			</div>

			<ul
				class="flex flex-col gap-3 text-sm sm:items-end"
				aria-label={footerContent.contactAriaLabel}>
				{#each contactItems as item}
					<li class="text-muted-foreground flex flex-col gap-1 sm:items-end">
						<span
							class="text-primary text-xs font-semibold tracking-widest uppercase">
							{item.label}
						</span>
						<a
							class="footer-link text-sm font-medium"
							href={item.href}>
							{item.value}
						</a>
					</li>
				{/each}
			</ul>
		</div>

		<div
			class="border-border flex flex-col gap-3 border-t pt-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
			<p class="text-muted-foreground text-sm font-medium">
				&copy; {currentYear}
				{footerContent.parentCompanyName}
			</p>
			<p class="text-muted-foreground text-sm">
				{footerContent.availability}
			</p>
		</div>
	</div>
</footer>

<style>
	.footer-link {
		color: var(--foreground);
		text-decoration-color: color-mix(in srgb, var(--primary) 70%, transparent);
		text-underline-offset: 0.22em;
		transition:
			color 160ms ease,
			text-decoration-color 160ms ease;
	}

	.footer-link:hover {
		color: var(--primary);
		text-decoration: underline;
	}

	.footer-link:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 3px;
		border-radius: 2px;
	}
</style>
