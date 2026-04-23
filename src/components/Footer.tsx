import { env } from "#/env";
import { Separator } from "#/components/ui/separator";

const footerContent = {
	studioName: "VV Podcast Studio",
	parentCompanyName: "Vertigo Visuals",
	lead: "The best studio in South West Sydney",
	availability: "Available for studio hire and production support",
	contactAriaLabel: "Contact details",
} as const;

const footerContactItems = [
	{
		label: "Phone",
		value: env.VITE_APP_CONTACT_PHONE,
		href: `tel:${env.VITE_APP_CONTACT_PHONE}`,
	},
	{
		label: "Email",
		value: env.VITE_APP_CONTACT_EMAIL,
		href: `mailto:${env.VITE_APP_CONTACT_EMAIL}`,
	},
	{
		label: "Location",
		value: env.VITE_APP_STUDIO_ADDRESS,
		href: env.VITE_APP_STUDIO_ADDRESS_URL,
	},
] as const;

const currentYear = new Date().toLocaleDateString(undefined, {
	year: "numeric",
});

export function Footer() {
	return (
		<footer className="px-4 py-10 sm:py-12">
			<Separator className="mb-10" />
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
				<div className="flex flex-col gap-5 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
					<div className="space-y-2">
						<p className="text-foreground text-xl font-black tracking-wide">
							{footerContent.studioName}
						</p>
						<p className="text-muted-foreground max-w-md text-sm leading-relaxed">
							{footerContent.lead}
						</p>
					</div>

					<ul
						aria-label={footerContent.contactAriaLabel}
						className="flex flex-col gap-3 text-sm sm:items-end">
						{footerContactItems.map((item) => (
							<li
								key={item.label}
								className="text-muted-foreground flex flex-col gap-1 sm:items-end">
								<span className="text-primary text-xs font-semibold tracking-widest uppercase">
									{item.label}
								</span>
								<a
									className="accent-link text-sm"
									href={item.href}>
									{item.value}
								</a>
							</li>
						))}
					</ul>
				</div>

				<div>
					<Separator className="mb-4" />
					<div className="flex flex-col gap-3 pt-0 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
						<p className="text-muted-foreground text-sm font-medium">
							&copy; {currentYear} {footerContent.parentCompanyName}
						</p>
						<p className="text-muted-foreground text-sm">{footerContent.availability}</p>
					</div>
				</div>
			</div>
		</footer>
	);
}
