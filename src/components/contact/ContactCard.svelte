<script lang="ts">
	import { onMount } from "svelte";
	import micImage from "../../assets/mic.jpg";
	import type { ContactItem } from "../../content/contact";

	export type ContactCardProps = {
		title: string;
		contactInfoAriaLabel: string;
		studioImageAlt: string;
		items: readonly ContactItem[];
	};

	let { title, contactInfoAriaLabel, studioImageAlt, items }: ContactCardProps =
		$props();

	let card = $state<HTMLElement | null>(null);
	let glare = $state<HTMLElement | null>(null);

	onMount(() => {
		const currentCard = card;
		const currentGlare = glare;

		if (!currentCard || !currentGlare) {
			return;
		}

		const prefersReducedMotion = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		);
		const supportsHover = window.matchMedia(
			"(hover: hover) and (pointer: fine)",
		);

		if (prefersReducedMotion.matches || !supportsHover.matches) {
			return;
		}

		let frame = 0;
		let nextTransform = "rotateX(0deg) rotateY(0deg)";
		let nextShadow = "0 24px 36px rgba(15, 23, 42, 0.18)";
		let nextGlareOpacity = "0";
		let nextGlareBackground = "none";
		const maxRotation = 5;

		const apply = () => {
			frame = 0;
			currentCard.style.transform = nextTransform;
			currentCard.style.boxShadow = nextShadow;
			currentGlare.style.opacity = nextGlareOpacity;
			currentGlare.style.background = nextGlareBackground;
		};

		const queueApply = () => {
			if (frame === 0) {
				frame = window.requestAnimationFrame(apply);
			}
		};

		const reset = () => {
			nextTransform = "rotateX(0deg) rotateY(0deg)";
			nextShadow = "0 24px 36px rgba(15, 23, 42, 0.18)";
			nextGlareOpacity = "0";
			nextGlareBackground = "none";
			queueApply();
		};

		const handlePointerMove = (event: PointerEvent) => {
			const rect = currentCard.getBoundingClientRect();
			const x = event.clientX - rect.left;
			const y = event.clientY - rect.top;
			const centerX = rect.width / 2;
			const centerY = rect.height / 2;
			const rotateY = -((x - centerX) / centerX) * maxRotation;
			const rotateX = -((centerY - y) / centerY) * maxRotation;
			const glareX = (x / rect.width) * 100;
			const glareY = (y / rect.height) * 100;

			nextTransform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
			nextShadow = `${(rotateY * 1.5).toFixed(2)}px ${(-rotateX * 2).toFixed(2)}px 34px rgba(15, 23, 42, 0.18)`;
			nextGlareOpacity = "0.18";
			nextGlareBackground = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.32), transparent 58%)`;
			queueApply();
		};

		currentCard.addEventListener("pointermove", handlePointerMove);
		currentCard.addEventListener("pointerleave", reset);
		currentCard.addEventListener("pointercancel", reset);

		return () => {
			currentCard.removeEventListener("pointermove", handlePointerMove);
			currentCard.removeEventListener("pointerleave", reset);
			currentCard.removeEventListener("pointercancel", reset);

			if (frame !== 0) {
				window.cancelAnimationFrame(frame);
			}
		};
	});
</script>

<div class="contact-card-scene">
	<div
		class="contact-card"
		bind:this={card}>
		<div
			class="contact-card__glare"
			aria-hidden="true"
			bind:this={glare}>
		</div>
		<img
			src={micImage.src}
			alt={studioImageAlt}
			class="contact-card__image h-auto w-full object-cover"
			loading="lazy"
			width={micImage.width}
			height={micImage.height} />
		<div
			class="contact-card__content absolute inset-x-0 bottom-0 px-6 py-6 sm:px-8 sm:py-8">
			<h1
				class="text-foreground text-3xl font-bold tracking-tight text-shadow-sm md:text-4xl">
				{title}
			</h1>

			<dl
				aria-label={contactInfoAriaLabel}
				class="mt-1 space-y-2 md:mt-6">
				{#each items as item (item.href)}
					<div class="grid gap-1">
						<dt class="text-foreground/70 text-base font-medium md:text-lg">
							{item.label}
						</dt>
						<dd class="min-w-0">
							<a
								class="contact-link text-foreground block text-base font-medium wrap-break-word md:text-lg"
								href={item.href}>
								{item.value}
							</a>
						</dd>
					</div>
				{/each}
			</dl>
		</div>
	</div>
</div>

<style>
	.contact-card-scene {
		perspective: 900px;
	}

	.contact-card {
		position: relative;
		overflow: hidden;
		border-radius: 2rem;
		border: 1px solid var(--border);
		transform-style: preserve-3d;
		transition:
			transform 120ms ease-out,
			box-shadow 180ms ease-out;
		will-change: transform;
		box-shadow: 0 24px 36px rgba(15, 23, 42, 0.18);
	}

	.contact-card__image {
		display: block;
	}

	.contact-card__glare {
		position: absolute;
		inset: 0;
		z-index: 1;
		border-radius: inherit;
		pointer-events: none;
		opacity: 0;
		transition: opacity 180ms ease-out;
	}

	.contact-card__content {
		z-index: 2;
		transform: translateZ(30px);
	}

	.contact-link {
		text-decoration-color: color-mix(in srgb, var(--primary) 65%, transparent);
		text-underline-offset: 0.22em;
		transition:
			color 160ms ease,
			text-decoration-color 160ms ease;
	}

	.contact-link:hover {
		color: var(--primary);
		text-decoration: underline;
	}

	.contact-link:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 3px;
		border-radius: 2px;
	}

	@media (hover: none), (pointer: coarse) {
		.contact-card {
			transform: none !important;
			box-shadow: 0 24px 36px rgba(15, 23, 42, 0.18);
		}

		.contact-card__glare {
			opacity: 0 !important;
			background: none !important;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.contact-card,
		.contact-card__glare,
		.contact-link {
			transition: none;
		}
	}
</style>
