export type ContactItem = {
	label: string;
	value: string;
	href: string;
};

export const studioAddress = "23 Fields Rd, Macquarie Fields NSW 2564";
export const studioAddressHref = "https://maps.app.goo.gl/pVx8fg9S4LhtKVjG7";
export const contactPhone = import.meta.env.APP_CONTACT_PHONE;
export const contactEmail = import.meta.env.APP_CONTACT_EMAIL;

export const contactItems: readonly ContactItem[] = [
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
	{
		label: "Location",
		value: studioAddress,
		href: studioAddressHref,
	},
];
