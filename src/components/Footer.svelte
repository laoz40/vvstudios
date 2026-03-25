<script lang="ts">
	import { Button } from "$lib/components/ui/button";

	const studioName = "vv studios";
	const companyName = "Vertigo Visuals";
	const companyLink = {
		label: companyName,
		href: undefined,
	};
	const address = "23 Fields Rd, Macquarie Fields NSW 2564";
	const footerLinks = [
		{ label: "Studios", href: undefined },
		{ label: "Weddings", href: undefined },
		{ label: "Marketing", href: undefined },
	] as const;

	const currentYear = new Date().toLocaleDateString(undefined, {
		year: "numeric",
	});
</script>

<footer class="footer border-border border-t px-4 py-8">
	<div
		class="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 text-center">
		<div class="flex flex-row items-center justify-center gap-4">
			<span class="text-lg font-bold">{studioName}</span>
			<p class="text-sm">
				From
				<Button
					href={companyLink.href}
					variant="link"
					size="sm"
					class="footer-link">
					{companyLink.label}
				</Button>
			</p>
		</div>
		<div class="flex flex-row items-center justify-center gap-8 text-sm">
			<p>{address}</p>
		</div>
		<div class="flex flex-row items-center justify-center gap-8">
			<p class="text-muted-foreground text-sm">
				&copy; {currentYear}
				{companyName}
			</p>
			<nav
				aria-label="Footer links"
				class="footer-links flex flex-wrap items-center justify-center gap-1 text-sm">
				{#each footerLinks as link, index}
					<Button
						href={link.href}
						variant="link"
						size="sm"
						class="footer-link">
						{link.label}
					</Button>
					{#if index < footerLinks.length - 1}
						<span
							aria-hidden="true"
							class="text-muted-foreground">•</span>
					{/if}
				{/each}
			</nav>
		</div>
	</div>
</footer>

<style>
	p {
		font-weight: var(--font-weight-medium);
		color: var(--muted-foreground);
		text-align: left;
	}

	.footer :global(.footer-link) {
		height: auto;
		padding: 0;
		font-size: var(--font-size-sm);
		font-weight: var(--font-weight-semibold);
		color: var(--muted-foreground);
	}

	.footer-links :global(.footer-link:hover) {
		text-decoration: underline;
	}
</style>
