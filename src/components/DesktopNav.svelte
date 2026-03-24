<script lang="ts">
	import { Button } from "$lib/components/ui/button";

	let { currentPath = "/" }: { currentPath?: string } = $props();

	type DropdownItem = {
		href: string;
		label: string;
	};

	type NavLink = {
		href: string;
		label: string;
		dropdown?: DropdownItem[];
	};

	const navLinks: NavLink[] = [
		{
			href: "/studios",
			label: "Recording Spaces",
			dropdown: [
				{ href: "/studios", label: "Open Setup" },
				{ href: "/studios", label: "Table Setup" },
			],
		},
		{ href: "/pricing", label: "Pricing" },
		{ href: "/about", label: "About" },
		{ href: "/contact", label: "Contact" },
	];
	const bookLink = { href: "/book", label: "Book Session" };
</script>

<nav
	aria-label="Primary navigation"
	class="fixed z-40 hidden w-full items-center justify-between border-b border-white/8 bg-black/15 px-4 py-3 backdrop-blur-md md:flex md:px-8 xl:px-24 2xl:px-40">
	<div>
		<Button
			href="/"
			aria-current={currentPath === "/" ? "page" : undefined}
			aria-label="VV Studios home"
			variant="link"
			size="sm"
			class="font-bold">
			vv studios
		</Button>
	</div>
	<ul class="flex items-center gap-8">
		{#each navLinks as link}
			<li class="relative group">
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
							class="rounded-md border border-white/10 bg-black/85 p-2 opacity-0 shadow-lg backdrop-blur-md transition duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
						>
							<ul class="flex flex-col gap-1">
								{#each link.dropdown as dropdownItem}
									<li>
										<a
											href={dropdownItem.href}
											class="block rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
		<li>
			<Button
				href={bookLink.href}
				aria-current={currentPath === "/book" ? "page" : undefined}
				size="sm">
				{bookLink.label}
			</Button>
		</li>
	</ul>
</nav>
