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

export type ContactFaqAnswerPart =
	| {
			type: "text";
			value: string;
	  }
	| {
			type: "email";
	  }
	| {
			type: "phone";
	  };

export type ContactFaqItem = {
	question: string;
	answerParts: readonly ContactFaqAnswerPart[];
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

export const contactFaqItems: readonly ContactFaqItem[] = [
	{
		question: "What’s included when I book a session?",
		answerParts: [
			{
				type: "text",
				value:
					"Each session includes a fully prepared studio with three 4K Sony cameras, up to four RØDE PodMic microphones, and cinematic lighting already set up.",
			},
		],
	},
	{
		question: "Do I need any experience to record?",
		answerParts: [
			{
				type: "text",
				value:
					"No experience is required. The space is designed for people who aren’t used to being on camera. We guide the setup so you can feel comfortable and focus on delivering your content naturally.",
			},
		],
	},
	{
		question: "Can I film content other than podcasts?",
		answerParts: [
			{
				type: "text",
				value:
					"Yes. The studio is suitable for podcasts, interviews, and business or marketing content. If you have a specific idea in mind, the setup can be adjusted to suit your shoot.",
			},
		],
	},
	{
		question: "Do you offer editing and post-production?",
		answerParts: [
			{
				type: "text",
				value:
					"Yes. Editing can be arranged depending on what you need, from full video edits to short-form content. Let us know what you’re aiming to produce and we’ll handle the post-production accordingly.",
			},
		],
	},
	{
		question: "Where are you located?",
		answerParts: [
			{
				type: "text",
				value:
					"The studio is based in Macquarie Fields, making it accessible for clients across Sydney. If you’re unsure about travel or access, feel free to reach out.",
			},
		],
	},
	{
		question: "Can I view the studio before booking?",
		answerParts: [
			{
				type: "text",
				value:
					"Yes. You can book a free tour to see the space, understand the setup, and make sure it suits what you’re looking to create.",
			},
		],
	},
	{
		question: "How do I make an enquiry?",
		answerParts: [
			{
				type: "text",
				value: "You can get in touch via email using ",
			},
			{
				type: "email",
			},
			{
				type: "text",
				value: " or phone using ",
			},
			{
				type: "phone",
			},
			{
				type: "text",
				value:
					" to discuss your requirements, check availability, and organise your session. We’ll guide you through the next steps based on what you need.",
			},
		],
	},
];
