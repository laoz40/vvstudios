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
  {
    heading?: string;
    value: string;
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
    question: "Can I film content other than podcasts?",
    answerParts: [
      {
        value:
          "Yes. The studio is suitable for podcasts, marketing content, voiceovers and music recordings. If you have a specific idea in mind, the setup can be adjusted to suit your creative needs.",
      },
    ],
  },
  {
    question: "What’s included when I book a session?",
    answerParts: [
      {
        value:
          "Each session includes a fully prepared space with three 4K Sony cameras, up to four RØDE PodMics, and cinematic overhead lighting.",
      },
    ],
  },
  {
    question: "Is there a producer included?",
    answerParts: [
      {
        value:
          "Yes, every session provides an experienced AV producer who will guide you through the recording process so you can focus on what you do best.",
      },
    ],
  },
  {
    question: "Do you offer editing and post-production?",
    answerParts: [
      {
        heading: "Essential Edit - $99",
        value:
          "Syncs audio to video, enhances sound to a broadcast-ready level, and includes multi-camera switching based on the active speaker.",
      },
      {
        heading: "Clips Package - $79",
        value:
          "10 curated clips (15-60s), selected for engagement potential, delivered in vertical format with subtitles for social media.",
      },
    ],
  },
];
