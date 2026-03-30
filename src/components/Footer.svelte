<script lang="ts">
	const studioName = "VV Podcast Studio";
	const address = "23 Fields Rd, Macquarie Fields NSW 2564";
	const addressHref = "https://maps.app.goo.gl/LkePeAa1Gb22KZSV6";
	const contactPhone = import.meta.env.APP_CONTACT_PHONE;
	const contactEmail = import.meta.env.APP_CONTACT_EMAIL;

	const currentYear = new Date().toLocaleDateString(undefined, {
		year: "numeric",
	});

	const contactItems = [
		{
			label: "Address",
			value: address,
			href: addressHref,
		},
		...(contactPhone
			? [
					{
						label: "Phone",
						value: contactPhone,
						href: `tel:${contactPhone}`,
					},
				]
			: []),
		...(contactEmail
			? [
					{
						label: "Email",
						value: contactEmail,
						href: `mailto:${contactEmail}`,
					},
				]
			: []),
	] as const;
</script>

<footer class="border-border border-t px-4 py-10 sm:py-12">
	<div class="mx-auto flex w-full max-w-5xl flex-col gap-6">
		<div
			class="flex flex-col gap-5 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
			<div class="space-y-2">
				<p class="text-foreground text-xl font-black tracking-wide">
					{studioName}
				</p>
				<p class="text-muted-foreground max-w-md text-sm leading-relaxed">
					Studio hire and production support in South West Sydney.
				</p>
			</div>

			<ul
				class="flex flex-col gap-3 text-sm sm:items-end"
				aria-label="Contact details">
				{#each contactItems as item}
					<li class="text-muted-foreground flex flex-col gap-1 sm:items-end">
						<span class="text-primary text-xs font-semibold tracking-widest uppercase">
							{item.label}
						</span>
						{#if "href" in item}
							<a
								class="footer-link text-sm font-medium"
								href={item.href}>
								{item.value}
							</a>
						{:else}
							<span class="font-medium">{item.value}</span>
						{/if}
					</li>
				{/each}
			</ul>
		</div>

		<div
			class="border-border flex flex-col gap-3 border-t pt-4 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
			<p class="text-muted-foreground text-sm font-medium">
				&copy; {currentYear} {studioName}
			</p>
			<p class="text-muted-foreground text-sm">
				Available for bookings, tours, and production enquiries.
			</p>
		</div>
	</div>
</footer>

<style>
	.footer-link {
		color: var(--foreground);
		text-decoration-color: color-mix(
			in srgb,
			var(--primary) 70%,
			transparent
		);
		text-underline-offset: 0.22em;
		transition:
			color 160ms ease,
			text-decoration-color 160ms ease;
	}

	.footer-link:hover {
		color: var(--primary);
		text-decoration: underline;
	}

	.footer-link:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 3px;
		border-radius: 2px;
	}
</style>
