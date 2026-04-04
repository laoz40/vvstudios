<script lang="ts">
	import XIcon from "@lucide/svelte/icons/x";
	import { onDestroy, tick } from "svelte";
	import { Button } from "$lib/components/ui/button";

	export type IframeModalProps = {
		open?: boolean;
		url: string;
		dialogLabel: string;
		closeLabel: string;
		iframeTitle: string;
		onClose?: () => void;
	};

	let {
		open = $bindable(false),
		url,
		dialogLabel,
		closeLabel,
		iframeTitle,
		onClose = () => {},
	}: IframeModalProps = $props();

	let lastFocusedEl: HTMLElement | null = $state(null);
	let closeButtonEl: HTMLButtonElement | null = $state(null);

	function portal(node: HTMLElement) {
		if (typeof document === "undefined") {
			return;
		}

		document.body.appendChild(node);

		return {
			destroy() {
				node.remove();
			},
		};
	}

	function setBackgroundInert(isInert: boolean) {
		if (typeof document === "undefined") {
			return;
		}

		const inertTargets = [
			document.getElementById("site-shell"),
			document.getElementById("mobile-nav-shell"),
		];

		for (const target of inertTargets) {
			if (!target) continue;
			target.inert = isInert;
		}
	}

	function closeModal() {
		open = false;
		onClose();
	}

	function handleOverlayClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			closeModal();
		}
	}

	function handleOverlayKeydown(event: KeyboardEvent) {
		if (
			event.target === event.currentTarget &&
			(event.key === "Enter" || event.key === " ")
		) {
			event.preventDefault();
			closeModal();
		}
	}

	$effect(() => {
		if (!open) {
			return;
		}

		if (typeof document !== "undefined") {
			lastFocusedEl = document.activeElement as HTMLElement | null;
		}

		setBackgroundInert(true);
		void tick().then(() => closeButtonEl?.focus());

		return () => {
			setBackgroundInert(false);

			if (lastFocusedEl?.isConnected) {
				lastFocusedEl.focus();
			}

			lastFocusedEl = null;
		};
	});

	onDestroy(() => {
		setBackgroundInert(false);
	});
</script>

<svelte:window
	onkeydown={(event) => {
		if (open && event.key === "Escape") {
			closeModal();
		}
	}} />

{#if open}
	<div
		use:portal
		class="fixed inset-0 z-9999 box-border flex items-center justify-center bg-black/70 p-4 sm:p-8"
		onclick={handleOverlayClick}
		onkeydown={handleOverlayKeydown}
		role="dialog"
		tabindex="0"
		aria-modal="true"
		aria-label={dialogLabel}>
		<div class="relative h-[90vh] md:h-[60vh] w-full max-w-7xl overflow-visible">
			<Button
				variant="destructive"
				size="icon"
				bind:ref={closeButtonEl}
				onclick={closeModal}
				aria-label={closeLabel}
				class="absolute -top-4 -right-4 z-10000 rounded-xl shadow-2xl md:-top-5 md:-right-5 md:size-12">
				<XIcon class="size-6" />
				<span class="sr-only">{closeLabel}</span>
			</Button>
			<div class="h-full w-full overflow-hidden rounded-lg">
				<iframe
					title={iframeTitle}
					src={url}
					class="h-full w-full border-none bg-white"
					sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox allow-storage-access-by-user-activation"
				></iframe>
			</div>
		</div>
	</div>
{/if}
