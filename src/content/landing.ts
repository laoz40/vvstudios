import {
	contactFaqItems,
	type ContactFaqAnswerPart,
	type ContactFaqItem,
} from "./contact";

export type HeroContent = {
	eyebrow: string;
	title: string;
	lead: string;
	secondaryCtaLabel: string;
	scrollAriaLabel: string;
	desktopBackgroundAlt: string;
	mobileBackgroundAlt: string;
	address: string;
};

export type FaqSectionContent = {
	title: string;
	items: readonly ContactFaqItem[];
};

export const flattenContactFaqAnswer = (parts: readonly ContactFaqAnswerPart[]) =>
	parts
		.map((part) => [part.heading, part.value].filter(Boolean).join("\n"))
		.join("")
		.trim();

export const heroContent: HeroContent = {
	eyebrow: "From Vertigo Visuals",
	title: "The Best Studio in South West Sydney",
	lead: "A space to focus on your business or craft. We take care of the production from setup to final product.",
	secondaryCtaLabel: "Take free tour",
	scrollAriaLabel: "Scroll to information section",
	desktopBackgroundAlt: "VV Podcast Studio interior with lights and set pieces",
	mobileBackgroundAlt: "VV Podcast Studio interior background image",
	address: "23 Fields Rd, Macquarie Fields NSW",
};

export const faqSectionContent: FaqSectionContent = {
	title: "Frequently Asked Questions",
	items: contactFaqItems,
};
