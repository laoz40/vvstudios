<script lang="ts">
	import { onMount } from "svelte";

	type SchedulingButton = {
		load: (options: {
			url: string;
			color?: string;
			label: string;
			target: Element;
		}) => void;
	};

	export type StudioBookingControlsProps = {
		studioLabel: string;
		bookingUrl: string;
		durations?: number[];
		buttonColor?: string;
	};

	let {
		studioLabel,
		bookingUrl,
		durations = [1, 2, 3, 4],
		buttonColor = "#deb201",
	}: StudioBookingControlsProps = $props();

	let selectedHours = $state(durations[0] ?? 1);
	let hostEl: HTMLDivElement | null = $state(null);
	let ready = $state(false);
	let destroyed = false;

	const getSchedulingButton = () => {
		const calendar = (window as unknown as { calendar?: unknown }).calendar as
			| { schedulingButton?: SchedulingButton }
			| undefined;

		return calendar?.schedulingButton;
	};

	const loadButton = () => {
		if (!hostEl) {
			return;
		}

		const schedulingButton = getSchedulingButton();

		if (!schedulingButton?.load) {
			return;
		}

		const label = `Book ${studioLabel} (${selectedHours} hour${
			selectedHours === 1 ? "" : "s"
		})`;

		// The Google widget can append asynchronously; if we reuse the same
		// container we can end up with duplicates. Replacing the container
		// ensures any late appends go into a detached node.
		const targetEl = document.createElement("div");
		targetEl.setAttribute("aria-label", `${studioLabel} booking button`);
		hostEl.replaceChildren(targetEl);

		schedulingButton.load({
			url: bookingUrl,
			color: buttonColor,
			label,
			target: targetEl,
		});
	};

	const waitForSchedulingButton = async () => {
		for (let attempt = 0; attempt < 200; attempt += 1) {
			if (destroyed) {
				return false;
			}

			if (getSchedulingButton()?.load) {
				return true;
			}

			await new Promise((resolve) => window.setTimeout(resolve, 50));
		}

		return false;
	};

	onMount(() => {
		destroyed = false;

		waitForSchedulingButton().then((isReady) => {
			if (!isReady || destroyed) {
				return;
			}

			ready = true;
		});

		return () => {
			destroyed = true;
		};
	});

	$effect(() => {
		if (!ready) {
			return;
		}
		loadButton();
	});
</script>

<div class="mt-auto pt-6">
	<label class="mb-2 block text-sm font-semibold text-white/90">
		Duration
		<select
			name="duration"
			class="mt-2 w-full rounded-md border border-white/15 bg-black/40 px-3 py-2 text-sm text-white backdrop-blur-sm outline-none transition focus:border-white/25 focus:ring-2 focus:ring-white/15"
			value={selectedHours}
			onchange={(event) => {
				selectedHours = Number(
					(event.currentTarget as HTMLSelectElement).value,
				);
			}}
		>
			{#each durations as hours}
				<option value={hours}>
					{hours} hour{hours === 1 ? "" : "s"}
				</option>
			{/each}
		</select>
	</label>

	<div class="pt-4" bind:this={hostEl}></div>
</div>
