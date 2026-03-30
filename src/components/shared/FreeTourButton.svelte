<script lang="ts">
	import type { HTMLButtonAttributes } from "svelte/elements";
	import { Button } from "$lib/components/ui/button";
	import type {
		ButtonSize,
		ButtonVariant,
	} from "$lib/components/ui/button/button";
	import { freeTourContent } from "../../content/tour";
	import IframeModal from "./IframeModal.svelte";

	export type FreeTourButtonProps = HTMLButtonAttributes & {
		label?: string;
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
	};

	let {
		label = freeTourContent.ctaLabel,
		variant = "outline",
		size = "lg",
		class: className,
		type = "button",
		disabled = false,
		onclick,
		...restProps
	}: FreeTourButtonProps = $props();

	let open = $state(false);

	function handleClick(event: MouseEvent) {
		onclick?.(event);

		if (event.defaultPrevented || disabled) {
			return;
		}

		open = true;
	}
</script>

<Button
	{variant}
	{size}
	{type}
	{disabled}
	class={className}
	onclick={handleClick}
	{...restProps}>
	{label}
</Button>

<IframeModal
	bind:open
	url={freeTourContent.url}
	dialogLabel={freeTourContent.modalDialogLabel}
	closeLabel={freeTourContent.modalCloseLabel}
	iframeTitle={freeTourContent.modalIframeTitle} />
