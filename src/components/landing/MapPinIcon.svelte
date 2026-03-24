<script lang="ts">
	import MapPin from "@lucide/svelte/icons/map-pin";
	import type { IconProps } from "@lucide/svelte";

	let { class: className, ...restProps }: IconProps = $props();
</script>

<MapPin class={className} {...restProps} />
