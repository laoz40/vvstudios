<script lang="ts">
	import { Button } from "$lib/components/ui/button";
</script>

<nav
	aria-label="Navigation menu"
	class="hidden md:flex w-full items-center justify-between p-4 py-3">
	<Button
		href="/"
		variant="link"
		size="sm"
		class="font-bold">
		vv studios
	</Button>
	<div class="flex items-center gap-8">
		<Button
			href="/studios"
			variant="link"
			size="sm">
			studios
		</Button>
		<Button
			href="/pricing"
			variant="link"
			size="sm">
			pricing
		</Button>
		<Button
			href="/about"
			variant="link"
			size="sm">
			about
		</Button>
		<Button
			href="/book"
			size="sm">
			book
		</Button>
	</div>
</nav>
