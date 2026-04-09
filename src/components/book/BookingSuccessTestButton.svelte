<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import { cn } from "$lib/utils.js";

	type Props = {
		onclick: () => void;
		disabled?: boolean;
		pressableClass: string;
	};

	let { onclick, disabled = false, pressableClass }: Props = $props();
</script>

<Button
	type="button"
	variant="outline"
	class={cn("h-12 w-full rounded-lg text-base font-semibold", pressableClass)}
	{disabled}
	onclick={onclick}>
	Open success dialog
</Button>
