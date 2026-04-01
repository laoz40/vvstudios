import { requireEnv } from "../lib/requireEnv";

export type ContactItem = {
	label: string;
	value: string;
	href: string;
};

export type ContactPageContent = {
	title: string;
	contactInfoAriaLabel: string;
	studioImageAlt: string;
	introText: string;
};

export const studioAddress = "23 Fields Rd, Macquarie Fields NSW 2564";
export const studioAddressHref = "https://maps.app.goo.gl/pVx8fg9S4LhtKVjG7";
export const contactPhone = requireEnv("APP_CONTACT_PHONE");
export const contactEmail = requireEnv("APP_CONTACT_EMAIL");
export const contactPageContent: ContactPageContent = {
	title: "Contact",
	contactInfoAriaLabel: "Contact information",
	studioImageAlt: "Studio microphone",
	introText:
		"Reach out if you want to book the studio, ask a question before you lock in a session, or get a better feel for how the space works. We work with business owners, creators and teams who want a professional setup without a drawn-out booking process.",
};

export const contactItems: readonly ContactItem[] = [
	{
		label: "Phone",
		value: contactPhone,
		href: `tel:${contactPhone}`,
	},
	{
		label: "Email",
		value: contactEmail,
		href: `mailto:${contactEmail}`,
	},
	{
		label: "Location",
		value: studioAddress,
		href: studioAddressHref,
	},
];
