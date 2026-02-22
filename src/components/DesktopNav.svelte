<script lang="ts">
	import { Button } from "$lib/components/ui/button";

	let { currentPath = "/" }: { currentPath?: string } = $props();

	const navLinks = [
		{ href: "/studios", label: "Studios" },
		{ href: "/pricing", label: "Pricing" },
		{ href: "/about", label: "About" },
	] as const;
	const bookLink = { href: "/book", label: "Book"}
</script>

<nav
	aria-label="Primary navigation"
	class="fixed z-40 hidden w-full items-center justify-between border-b border-white/8 bg-black/40 p-4 py-3 backdrop-blur-md md:flex">
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
			<li>
				<Button
					href={link.href}
					aria-current={currentPath === link.href ? "page" : undefined}
					variant="link"
					size="sm">
					{link.label}
				</Button>
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
