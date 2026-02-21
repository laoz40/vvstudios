<script lang="ts">
import { Button } from "$lib/components/ui/button";

const studioName = "vv studios";
const companyName = "Vertigo Visuals";
const linkButtonClass = "h-auto px-1 py-0 text-muted-foreground font-semibold";
const companyLink = {
	label: companyName,
	href: undefined,
};
const footerLinks = [
	{ label: "Studios", href: undefined },
	{ label: "Weddings", href: undefined },
	{ label: "Marketing", href: undefined },
] as const;

const currentYear = new Date().toLocaleDateString(undefined, {
	year: "numeric",
});
</script>

<footer class="border-t border-border px-4 py-8">
	<div class="mx-auto flex w-full max-w-5xl flex-col items-center gap-2 text-center">
		<div class="flex flex-row items-center justify-center gap-4">
			<span class="text-lg font-bold">{studioName}</span>
			<p class="text-sm text-muted-foreground">
				From
				<Button
					href={companyLink.href}
					variant="link"
					size="sm"
					class={`${linkButtonClass} text-sm p-0`}
				>
					{companyLink.label}
				</Button>
			</p>
		</div>
		<div class="flex flex-row items-center justify-center gap-8">
			<p class="text-sm text-muted-foreground">&copy; {currentYear} {companyName}</p>
			<nav
				aria-label="Footer links"
				class="flex flex-wrap items-center justify-center gap-1 text-sm"
			>
				{#each footerLinks as link, index}
					<Button
						href={link.href}
						variant="link"
						size="sm"
						class={linkButtonClass}
					>
						{link.label}
					</Button>
					{#if index < footerLinks.length - 1}
						<span aria-hidden="true" class="text-muted-foreground">•</span>
					{/if}
				{/each}
			</nav>
		</div>
	</div>
</footer>

<style>
	p {
		font-weight: var(--font-weight-medium);
	}
</style>
