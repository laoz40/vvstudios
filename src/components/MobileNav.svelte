<script lang="ts">
	import Menu from "@lucide/svelte/icons/menu";
	import X from "@lucide/svelte/icons/x";
	import { Button } from "$lib/components/ui/button";
	import { navContent } from "../content/navigation";

	let { currentPath = "/" }: { currentPath?: string } = $props();

	let isOpen = $state(false);
	const navLinks = navContent.mobile.links;
	const bookLink = navContent.mobile.bookLink;

	const closeMenu = () => {
		isOpen = false;
	};

	const handleKeydown = (event: KeyboardEvent) => {
		if (isOpen && event.key === "Escape") {
			closeMenu();
		}
	};

	$effect(() => {
		const siteShell = document.getElementById("site-shell");

		if (!siteShell) {
			return;
		}

		if (isOpen) {
			siteShell.setAttribute("inert", "");
		} else {
			siteShell.removeAttribute("inert");
		}

		return () => {
			siteShell.removeAttribute("inert");
		};
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<nav
	aria-label={navContent.mobile.navAriaLabel}
	class="fixed z-40 flex w-full flex-row items-center justify-between border-b border-white/8 bg-black/15 px-4 py-3 backdrop-blur-md md:hidden">
	<div>
		<Button
			href="/"
			aria-label={navContent.homeAriaLabel}
			variant="link"
			size="sm"
			class="font-bold">
			{navContent.brandLabel}
		</Button>
	</div>
	<button
		type="button"
		aria-label={isOpen
			? navContent.mobile.closeNavAriaLabel
			: navContent.mobile.openNavAriaLabel}
		aria-expanded={isOpen}
		aria-controls="mobile-nav-panel"
		class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
		onclick={() => {
			isOpen = !isOpen;
		}}>
		<span class="sr-only"
			>{isOpen
				? navContent.mobile.closeMenuSrText
				: navContent.mobile.openMenuSrText}</span>
		<span aria-hidden="true">
			<Menu />
		</span>
	</button>

	{#if isOpen}
		<button
			type="button"
			class="fixed inset-0 z-40 bg-black/60"
			onclick={closeMenu}
			aria-label={navContent.mobile.closeNavAriaLabel}></button>
		<div
			id="mobile-nav-panel"
			class="border-border bg-background fixed top-0 right-0 z-50 flex h-screen w-72 max-w-[90vw] flex-col border-l p-6">
			<div class="mb-6 flex items-center justify-between">
				<p class="text-muted-foreground text-sm font-semibold tracking-wide">
					{navContent.brandLabel}
				</p>
				<button
					type="button"
					class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring rounded-md p-2 transition-colors focus-visible:ring-2 focus-visible:outline-none"
					aria-label={navContent.mobile.closeNavAriaLabel}
					onclick={closeMenu}>
					<span aria-hidden="true">
						<X />
					</span>
				</button>
			</div>
			<ul class="flex flex-col gap-2">
				{#each navLinks as link}
					<li>
						<a
							href={link.href}
							aria-current={currentPath === link.href ? "page" : undefined}
							class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring block rounded-md px-3 py-2 text-base font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
							onclick={closeMenu}>
							{link.label}
						</a>
					</li>
				{/each}
				<li>
					<a
						href={bookLink.href}
						aria-current={currentPath === "/book" ? "page" : undefined}
						class="bg-primary text-primary-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring block rounded-md px-3 py-2 text-base font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
						onclick={closeMenu}>
						{bookLink.label}
					</a>
				</li>
			</ul>
		</div>
	{/if}
</nav>
