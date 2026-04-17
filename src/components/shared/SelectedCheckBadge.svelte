<script lang="ts">
	import CheckIcon from "@lucide/svelte/icons/check";
	import { cn } from "$lib/utils.js";

	export type SelectedCheckBadgeProps = {
		class?: string;
		label?: string;
	};

	let { class: className = "", label = "Selected" }: SelectedCheckBadgeProps = $props();
</script>

<span
	class={cn(
		"bg-primary text-primary-foreground inline-flex items-center justify-center rounded-full p-1",
		className,
	)}
	aria-label={label}>
	<CheckIcon class="size-4" />
</span>
