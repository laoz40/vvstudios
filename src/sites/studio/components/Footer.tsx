import { Link } from "@tanstack/react-router";
import { Separator } from "#/components/ui/separator";
import { studioSite } from "#/config/sites";
import {
	CONTACT_EMAIL,
	CONTACT_PHONE,
	INSTAGRAM_URL,
	STUDIO_ADDRESS,
	STUDIO_ADDRESS_URL,
} from "#/config/contact";
import { GiveFeedbackDialog } from "#studio/components/GiveFeedbackDialog";

const footerContent = {
	studioName: "VV Studios",
	parentCompanyName: "Vertigo Visuals",
	lead: "The best studio in South West Sydney",
	contactAriaLabel: "Contact details",
} as const;

const footerContactItems = [
	{
		label: "Phone",
		value: CONTACT_PHONE,
		href: `tel:${CONTACT_PHONE}`,
	},
	{
		label: "Email",
		value: CONTACT_EMAIL,
		href: `mailto:${CONTACT_EMAIL}`,
	},
	{
		label: "Location",
		value: STUDIO_ADDRESS,
		href: STUDIO_ADDRESS_URL,
	},
] as const;

const currentYear = new Date().toLocaleDateString(undefined, {
	year: "numeric",
});

export function Footer() {
	return (
		<footer className="relative z-20 bg-neutral-900 px-4 py-10 sm:py-12 md:px-12 lg:px-24 xl:px-32 2xl:px-48">
			<div className="flex w-full flex-col gap-6">
				<div className="flex flex-col gap-6 text-left">
					<div className="space-y-2">
						<p className="text-foreground text-xl font-black tracking-wide">
							{footerContent.studioName}
						</p>
						<p className="text-muted-foreground max-w-md text-sm leading-relaxed">
							{footerContent.lead}
						</p>
					</div>

					<div className="flex items-start justify-between gap-6">
						<ul
							aria-label={footerContent.contactAriaLabel}
							className="flex flex-col items-start gap-3 text-sm">
							{footerContactItems.map((item) => (
								<li
									key={item.label}
									className="text-muted-foreground flex flex-col items-start gap-1">
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

						<div className="text-muted-foreground flex flex-col items-end gap-1 text-right text-sm">
							<span className="text-primary text-xs font-semibold tracking-widest uppercase">
								Socials
							</span>
							<a
								className="accent-link text-sm"
								href={INSTAGRAM_URL}
								rel="noreferrer"
								target="_blank">
								Instagram
							</a>
						</div>
					</div>
				</div>

				<div>
					<Separator className="mb-4" />
					<div className="flex items-start justify-between gap-6 pt-0 sm:items-center">
						<div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-4">
							<GiveFeedbackDialog />
							<Link
								className="accent-link text-sm"
								to={studioSite.routes.termsAndConditions}>
								Terms & Conditions
							</Link>
							<Link
								className="accent-link text-sm"
								to={studioSite.routes.privacyPolicy}>
								Privacy Policy
							</Link>
						</div>
						<p className="text-muted-foreground text-right text-sm font-medium">
							&copy; {currentYear} {footerContent.parentCompanyName}
						</p>
					</div>
				</div>
			</div>
		</footer>
	);
}
