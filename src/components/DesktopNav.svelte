<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { navContent } from "../content/navigation";

	let { currentPath = "/" }: { currentPath?: string } = $props();
	const navLinks = navContent.desktop.links;
	const bookLink = navContent.desktop.bookLink;
	const backHomeLink = navContent.desktop.backHomeLink;
	const isBookPage = currentPath === "/book";
</script>

<div class="fixed top-4 left-1/2 z-40 hidden w-full max-w-7xl -translate-x-1/2 px-4 md:block">
	<nav
		aria-label={navContent.desktop.navAriaLabel}
		class="border-border/70 bg-background/30 rounded-md border px-4 py-3 shadow-lg backdrop-blur-md"
	>
		<div class="grid grid-cols-3 items-center gap-4">
			<div class="justify-self-start">
				<Button
					href="/"
					aria-current={currentPath === "/" ? "page" : undefined}
					aria-label={navContent.homeAriaLabel}
					variant="link"
					size="sm"
					class="font-bold tracking-wide">
					{navContent.brandLabel}
				</Button>
			</div>

			<ul class="flex items-center justify-center gap-6 justify-self-center">
				{#each navLinks as link}
					<li class="group relative">
						<Button
							href={link.href}
							aria-current={currentPath === link.href ? "page" : undefined}
							variant="link"
							size="sm">
							{link.label}
						</Button>
						{#if link.dropdown}
							<div
								class="pointer-events-none absolute left-1/2 top-full w-44 -translate-x-1/2 pt-2 group-hover:pointer-events-auto group-focus-within:pointer-events-auto"
							>
								<div
									class="bg-background/95 border-border rounded-md border p-2 opacity-0 shadow-lg backdrop-blur-md transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
								>
									<ul class="flex flex-col gap-1">
										{#each link.dropdown as dropdownItem}
											<li>
												<a
													href={dropdownItem.href}
													class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring block rounded-md px-3 py-2 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2"
												>
													{dropdownItem.label}
												</a>
											</li>
										{/each}
									</ul>
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>

			<div class="justify-self-end">
				{#if isBookPage}
					<Button href={backHomeLink.href} variant="secondary" size="default">
						{backHomeLink.label}
					</Button>
				{:else}
					<Button
						href={bookLink.href}
						aria-current={currentPath === "/book" ? "page" : undefined}
						size="default">
						{bookLink.label}
					</Button>
				{/if}
			</div>
		</div>
	</nav>
</div>
