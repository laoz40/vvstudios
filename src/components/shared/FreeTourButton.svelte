<script lang="ts">
	import { Button } from "$lib/components/ui/button";
	import type {
		ButtonProps,
		ButtonSize,
		ButtonVariant,
	} from "$lib/components/ui/button/button";
	import { freeTourContent } from "../../content/tour";
	import IframeModal from "./IframeModal.svelte";

	type ButtonClickEvent = Parameters<NonNullable<ButtonProps["onclick"]>>[0];

	export type FreeTourButtonProps = Omit<ButtonProps, "children" | "onclick"> & {
		label?: string;
		variant?: ButtonVariant;
		size?: ButtonSize;
		class?: string;
		onclick?: ButtonProps["onclick"];
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

	const handleClick: NonNullable<ButtonProps["onclick"]> = (event) => {
		onclick?.(event);

		if (event.defaultPrevented || disabled) {
			return;
		}

		open = true;
	};
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
