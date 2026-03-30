import { studioAddress } from "./contact";

export type HeroContent = {
	eyebrow: string;
	title: string;
	lead: string;
	primaryCtaLabel: string;
	primaryCtaHref: string;
	secondaryCtaLabel: string;
	scrollAriaLabel: string;
	address: string;
};

export const heroContent: HeroContent = {
	eyebrow: "From Vertigo Visuals",
	title: "The Only Pro Studio in South West Sydney",
	lead: "A space to focus on your business or craft. We take care of the production from setup through to final output.",
	primaryCtaLabel: "Book session",
	primaryCtaHref: "/book",
	secondaryCtaLabel: "Take free tour",
	scrollAriaLabel: "Scroll to information section",
	address: studioAddress,
};
