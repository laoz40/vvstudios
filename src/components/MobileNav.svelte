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
		aria-label={isOpen ? navContent.mobile.closeNavAriaLabel : navContent.mobile.openNavAriaLabel}
		aria-expanded={isOpen}
		aria-controls="mobile-nav-panel"
		class="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		on:click={() => {
			isOpen = !isOpen;
		}}
	>
		<span class="sr-only">{isOpen ? navContent.mobile.closeMenuSrText : navContent.mobile.openMenuSrText}</span>
		<span aria-hidden="true">
			<Menu />
		</span>
	</button>

	{#if isOpen}
		<button
			type="button"
			class="fixed inset-0 z-40 bg-black/60"
			on:click={closeMenu}
			aria-label={navContent.mobile.closeNavAriaLabel}
		></button>
		<div
			id="mobile-nav-panel"
			class="fixed right-0 top-0 z-50 flex h-screen w-72 max-w-[90vw] flex-col border-l border-border bg-background p-6"
		>
			<div class="mb-6 flex items-center justify-between">
				<p class="text-sm font-semibold tracking-wide text-muted-foreground">
					{navContent.brandLabel}
				</p>
				<button
					type="button"
					class="rounded-md p-2 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					aria-label={navContent.mobile.closeNavAriaLabel}
					on:click={closeMenu}
				>
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
							class="block rounded-md px-3 py-2 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							on:click={closeMenu}
						>
							{link.label}
						</a>
					</li>
				{/each}
				<li>
					<a
						href={bookLink.href}
						aria-current={currentPath === "/book" ? "page" : undefined}
						class="block rounded-md px-3 py-2 text-base font-medium bg-primary text-primary-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						on:click={closeMenu}
					>
						{bookLink.label}
					</a>
				</li>
			</ul>
		</div>
	{/if}
</nav>
