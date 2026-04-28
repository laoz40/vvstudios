<script lang="ts">
	import { onMount } from "svelte";
	import { fade, fly } from "svelte/transition";
	import Menu from "@lucide/svelte/icons/menu";
	import X from "@lucide/svelte/icons/x";
	import {
		animate,
		type AnimationOptions,
		type DOMKeyframesDefinition,
	} from "motion";
	import { Button } from "$lib/components/ui/button";
	import logoYellow from "../assets/vv-logo-yellow.svg?url";
	import { navContent } from "../content/navigation";

	let { currentPath = "/" }: { currentPath?: string } = $props();

	let isOpen = $state(false);
	const navLinks = navContent.mobile.links;
	const bookLink = navContent.mobile.bookLink;
	const backHomeLink = navContent.mobile.backHomeLink;
	const isHomePage = $derived(currentPath === "/");
	const isBookPage = $derived(currentPath === "/book");
	let blurEnabled = $derived(currentPath !== "/");
	let navMotionEl: HTMLDivElement | null = $state(null);
	let prefersReducedMotion = $state(false);
	const getTransitionDuration = (normalDuration: number) =>
		prefersReducedMotion ? 0 : normalDuration;

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

	onMount(() => {
		prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		).matches;

		if (!navMotionEl || !isHomePage) return;

		if (prefersReducedMotion) {
			navMotionEl.style.opacity = "1";
			navMotionEl.style.transform = "translateY(0px)";
			blurEnabled = true;
			return;
		}

		const keyframes: DOMKeyframesDefinition = {
			opacity: [0, 1],
			transform: ["translateY(-32px)", "translateY(0px)"],
		};
		const options: AnimationOptions = {
			duration: 0.75,
			ease: "easeOut",
		};
		const controls = animate(navMotionEl, keyframes, options);

		void controls.finished.then(() => {
			blurEnabled = true;
		});
	});
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="fixed top-2 z-40 w-full px-4 md:hidden">
	<div
		bind:this={navMotionEl}
		style={isHomePage
			? "opacity: 0; transform: translateY(-24px);"
			: undefined}>
		<nav
			aria-label={navContent.mobile.navAriaLabel}
			class={`border-border/70 bg-background/30 flex h-14 flex-row items-center justify-between rounded-md border px-2 shadow-lg transition duration-700 ease-out ${
				blurEnabled ? "backdrop-blur-xs" : "backdrop-blur-none"
			}`}>
			<div class="flex h-full items-center">
				<Button
					href="/"
					aria-label={navContent.homeAriaLabel}
					variant="link"
					size="sm"
					class="inline-flex h-full items-center gap-2 font-mono text-xl font-bold no-underline hover:no-underline">
					<img
						src={logoYellow}
						alt=""
						class="size-7 md:size-5 shrink-0"
						aria-hidden="true" />
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
		</nav>
	</div>
</div>

{#if isOpen}
	<button
		type="button"
		in:fade={{ duration: getTransitionDuration(220) }}
		out:fade={{ duration: getTransitionDuration(220) }}
		class="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden"
		onclick={closeMenu}
		aria-label={navContent.mobile.closeNavAriaLabel}></button>
	<div
		id="mobile-nav-panel"
		in:fly={{ x: 48, duration: getTransitionDuration(260) }}
		out:fly={{ x: 48, duration: getTransitionDuration(220) }}
		class="border-border bg-background fixed top-0 right-0 z-50 flex h-screen w-72 max-w-[90vw] flex-col border-l p-5 shadow-xl md:hidden">
		<div class="mb-5 flex items-center justify-between border-b pb-4">
			<p class="text-muted-foreground text-lg font-mono font-semibold tracking-wide">
				{navContent.brandLabel}
			</p>
			<button
				type="button"
				class="text-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors focus-visible:ring-2 focus-visible:outline-none"
				aria-label={navContent.mobile.closeNavAriaLabel}
				onclick={closeMenu}>
				<span aria-hidden="true">
					<X />
				</span>
			</button>
		</div>
		<ul class="flex flex-col gap-1">
			{#each navLinks as link}
				<li>
					<a
						href={link.href}
						aria-current={currentPath === link.href ? "page" : undefined}
						class={`focus-visible:ring-ring flex h-11 items-center rounded-md px-3 text-base font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
							currentPath === link.href
								? "bg-accent text-accent-foreground"
								: "text-foreground hover:bg-accent hover:text-accent-foreground"
						}`}
						onclick={closeMenu}>
						{link.label}
					</a>
				</li>
			{/each}
			<li class="mt-3 border-t pt-4">
				{#if isBookPage}
					<Button
						href={backHomeLink.href}
						variant="secondary"
						size="default"
						class="h-11 w-full justify-center"
						onclick={closeMenu}>
						{backHomeLink.label}
					</Button>
				{:else}
					<Button
						href={bookLink.href}
						aria-current={currentPath === "/book" ? "page" : undefined}
						size="default"
						class="h-11 w-full justify-center"
						onclick={closeMenu}>
						{bookLink.label}
					</Button>
				{/if}
			</li>
		</ul>
	</div>
{/if}
