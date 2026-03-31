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
};

export const studioAddress = "23 Fields Rd, Macquarie Fields NSW 2564";
export const studioAddressHref = "https://maps.app.goo.gl/pVx8fg9S4LhtKVjG7";
export const contactPhone = requireEnv("APP_CONTACT_PHONE");
export const contactEmail = requireEnv("APP_CONTACT_EMAIL");
export const contactPageContent: ContactPageContent = {
	title: "Contact",
	contactInfoAriaLabel: "Contact information",
	studioImageAlt: "Studio microphone",
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
