import { bookSessionCta } from "./cta";

export type NavLink = {
	href: string;
	label: string;
};

export type NavCta = {
	href: string;
	label: string;
};

export const navContent = {
	brandLabel: "VV PODCAST STUDIO",
	homeAriaLabel: "VV Podcast Studio home",
	desktop: {
		navAriaLabel: "Primary navigation",
		links: [
			{ href: "/photos", label: "Photos" },
			{ href: "/pricing", label: "Pricing" },
			{ href: "/contact", label: "Contact" },
		] satisfies NavLink[],
		bookLink: bookSessionCta satisfies NavCta,
		backHomeLink: { href: "/", label: "Back to home" } satisfies NavCta,
	},
	mobile: {
		navAriaLabel: "Navigation Menu",
		openNavAriaLabel: "Open navigation menu",
		closeNavAriaLabel: "Close navigation menu",
		openMenuSrText: "Open menu",
		closeMenuSrText: "Close menu",
		links: [
			{ href: "/", label: "Home" },
			{ href: "/photos", label: "Photos" },
			{ href: "/pricing", label: "Pricing" },
			{ href: "/contact", label: "Contact" },
		] satisfies NavLink[],
		bookLink: bookSessionCta satisfies NavCta,
		backHomeLink: { href: "/", label: "Back to home" } satisfies NavCta,
	},
};
