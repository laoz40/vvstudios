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

export type FaqItem = {
	question: string;
	answer: string;
};

export type FaqSectionContent = {
	title: string;
	items: FaqItem[];
};

export const heroContent: HeroContent = {
	eyebrow: "From Vertigo Visuals",
	title: "The Only Pro Studio in South West Sydney",
	lead: "A space to focus on your business or craft. We take care of the production from setup through to final output.",
	secondaryCtaLabel: "Take free tour",
	scrollAriaLabel: "Scroll to information section",
	desktopBackgroundAlt: "VV Podcast Studio interior with lights and set pieces",
	mobileBackgroundAlt: "VV Podcast Studio interior background image",
	address: "23 Fields Rd, Macquarie Fields NSW",
};

export const faqSectionContent: FaqSectionContent = {
	title: "Frequently Asked Questions",
	items: [
		{
			question: "Do I need my own equipment?",
			answer:
				"No. The studio is fully set up with professional cameras, audio, and lighting. You can walk in and focus on your content.",
		},
		{
			question: "I’ve never recorded before, is that a problem?",
			answer:
				"Not at all. The setup is handled for you, so you can get comfortable quickly and focus on delivering your content.",
		},
		{
			question: "What’s included in a session?",
			answer:
				"Everything needed to record high-quality content is ready to go. If you need editing or specific outputs, that can be arranged as well.",
		},
		{
			question:
				"Can I use the space for content other than podcasts?",
			answer:
				"Yes. The studio is also used for interviews, marketing content, and branded video, depending on what you need to create.",
		},
	],
};
