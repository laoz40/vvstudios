import { Link } from "@tanstack/react-router";
import { Separator } from "#/components/ui/separator";
import { studioSite } from "#/config/sites";
import {
	CONTACT_EMAIL,
	CONTACT_PHONE,
	INSTAGRAM_URL,
	STUDIO_ADDRESS,
	STUDIO_ADDRESS_URL
} from "#/config/contact";
import { cn } from "#/lib/utils";
import { GiveFeedbackModalButton } from "#studio/components/GiveFeedbackModal";

const footerContent = {
	studioName: "VV Studios",
	parentCompanyName: "Vertigo Visuals",
	lead: "The best studio in South West Sydney",
	contactAriaLabel: "Contact details"
} as const;

const footerContactItems = [
	{ label: "Phone", value: CONTACT_PHONE, href: `tel:${CONTACT_PHONE}` },
	{ label: "Email", value: CONTACT_EMAIL, href: `mailto:${CONTACT_EMAIL}` },
	{ label: "Location", value: STUDIO_ADDRESS, href: STUDIO_ADDRESS_URL }
] as const;

const currentYear = new Date().toLocaleDateString(undefined, { year: "numeric" });

export function Footer() {
	return (
		<footer
			className={cn(
				"relative z-20",
				"px-4 py-10 sm:py-12 md:px-12 lg:px-24 xl:px-32 2xl:px-48",
				"bg-neutral-950"
			)}>
			<div className="flex w-full flex-col gap-6">
				<div className="flex flex-col gap-6 text-left">
					<div className="space-y-2">
						<p className="text-foreground text-xl font-black tracking-wide">
							{footerContent.studioName}
						</p>
						<p className="max-w-md text-sm leading-relaxed text-muted-foreground">
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
									className="flex flex-col items-start gap-1 text-muted-foreground">
									<span className="text-xs font-semibold tracking-widest text-primary">
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

						<div className="flex flex-col items-end gap-1 text-right text-sm text-muted-foreground">
							<span className="text-xs font-semibold tracking-widest text-primary">Socials</span>
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
							<GiveFeedbackModalButton />
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
						<p className="text-right text-sm font-medium text-muted-foreground">
							&copy; {currentYear} {footerContent.parentCompanyName}
						</p>
					</div>
				</div>
			</div>
		</footer>
	);
}
