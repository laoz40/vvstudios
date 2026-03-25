export type NavDropdownItem = {
	href: string;
	label: string;
};

export type NavLink = {
	href: string;
	label: string;
	dropdown?: NavDropdownItem[];
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
			{
				href: "/spaces",
				label: "Recording Spaces",
				dropdown: [
					{ href: "/spaces", label: "Browse Setups" },
					{ href: "/spaces", label: "View Equipment" },
				],
			},
			{ href: "/pricing", label: "Pricing" },
			{ href: "/contact", label: "Contact" },
		] satisfies NavLink[],
		bookLink: { href: "/book", label: "Book Session" } satisfies NavCta,
		backHomeLink: { href: "/", label: "Back to Home" } satisfies NavCta,
	},
	mobile: {
		navAriaLabel: "Navigation Menu",
		openNavAriaLabel: "Open navigation menu",
		closeNavAriaLabel: "Close navigation menu",
		openMenuSrText: "Open menu",
		closeMenuSrText: "Close menu",
		links: [
			{ href: "/", label: "Home" },
			{ href: "/spaces", label: "Recording Spaces" },
			{ href: "/pricing", label: "Pricing" },
			{ href: "/contact", label: "Contact" },
		] satisfies NavLink[],
		bookLink: { href: "/book", label: "Book Session" } satisfies NavCta,
	},
};
