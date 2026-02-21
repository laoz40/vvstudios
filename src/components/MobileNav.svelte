<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import X from "@lucide/svelte/icons/x";
	import Menu from "@lucide/svelte/icons/menu";

	let { currentPath = "/" }: { currentPath?: string } = $props();

	let isOpen = $state(false);

	const navLinks = [
		{ href: "/", label: "Home" },
		{ href: "/studios", label: "Studios" },
		{ href: "/pricing", label: "Pricing" },
		{ href: "/about", label: "About" },
	] as const;
	const bookLink = { href: "/book", label: "Book Session"}

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
	aria-label="Navigation Menu"
	class="md:hidden flex flex-row items-center justify-between py-3 px-4 fixed w-full">
	<div>
		<Button
			href="/"
			aria-label="VV Studios home"
			variant="link"
			size="sm"
			class="font-bold">
			vv studios
		</Button>
	</div>
	<button
		type="button"
		aria-label={isOpen ? "Close navigation menu" : "Open navigation menu"}
		aria-expanded={isOpen}
		aria-controls="mobile-nav-panel"
		class="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
		onclick={() => {
			isOpen = !isOpen;
		}}
	>
		<span class="sr-only">{isOpen ? "Close menu" : "Open menu"}</span>
		<span aria-hidden="true">
			<Menu />
		</span>
	</button>

	{#if isOpen}
		<button
			type="button"
			class="fixed inset-0 z-40 bg-black/60"
			onclick={closeMenu}
			aria-label="Close navigation menu"
		></button>
		<div
			id="mobile-nav-panel"
			class="fixed right-0 top-0 z-50 flex h-screen w-72 max-w-[90vw] flex-col border-l border-border bg-background p-6"
		>
			<div class="mb-6 flex items-center justify-between">
				<p class="text-sm font-semibold tracking-wide text-muted-foreground">
					vv studios
				</p>
				<button
					type="button"
					class="rounded-md p-2 text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					aria-label="Close navigation menu"
					onclick={closeMenu}
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
							onclick={closeMenu}
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
						onclick={closeMenu}
					>
						{bookLink.label}
					</a>
				</li>
			</ul>
		</div>
	{/if}
</nav>
