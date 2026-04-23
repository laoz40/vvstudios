import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import micImage from "#/assets/mic.webp";
import { Button } from "#/components/ui/button";
import { Separator } from "#/components/ui/separator";
import { env } from "#/env";
import { cn } from "#/lib/utils";

type ContactItem = {
	label: string;
	value: string;
	href: string;
};

type ContactFaqAnswerPart =
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

type ContactFaqItem = {
	question: string;
	answerParts: readonly ContactFaqAnswerPart[];
};

const contactCardCopy = {
	title: "Contact",
	contactInfoAriaLabel: "Contact information",
	studioImageAlt: "Studio microphone",
} as const;

const contactItems: readonly ContactItem[] = [
	{
		label: "Phone",
		value: env.VITE_APP_CONTACT_PHONE,
		href: `tel:${env.VITE_APP_CONTACT_PHONE}`,
	},
	{
		label: "Email",
		value: env.VITE_APP_CONTACT_EMAIL,
		href: `mailto:${env.VITE_APP_CONTACT_EMAIL}`,
	},
	{
		label: "Location",
		value: env.VITE_APP_STUDIO_ADDRESS,
		href: env.VITE_APP_STUDIO_ADDRESS_URL,
	},
] as const;

const directContactItems = contactItems.filter((item) => item.label !== "Location");

const faqSectionCopy = {
	title: "Frequently Asked Questions",
} as const;

const contactFaqItems: readonly ContactFaqItem[] = [
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
] as const;

const contactActionCopy = {
	bookCta: "Book session",
	tourCta: "Take free tour",
} as const;

export function ContactPage() {
	return (
		<section className="px-4 pb-12 sm:pb-16">
			<div className="mx-auto w-full max-w-2xl">
				<ContactCard />
			</div>
			<ContactFaqSection />
			<Separator className="mx-auto my-4 max-w-6xl" />
			<div className="mx-auto mt-7 flex max-w-6xl flex-wrap gap-4 sm:gap-3 md:mt-12">
				<Button
					asChild
					size="lg"
					className="min-w-64 flex-1 border-2 border-primary px-4 py-5 text-base font-semibold sm:px-8">
					<Link to="/book">{contactActionCopy.bookCta}</Link>
				</Button>
				<Button
					type="button"
					variant="outline"
					size="lg"
					className="min-w-64 flex-1 border-2 px-4 py-5 text-base font-semibold sm:px-8">
					{contactActionCopy.tourCta}
				</Button>
			</div>
		</section>
	);
}

function ContactCard() {
	const cardRef = useRef<HTMLDivElement | null>(null);
	const glareRef = useRef<HTMLDivElement | null>(null);

	useEffect(() => {
		const card = cardRef.current;
		const glare = glareRef.current;

		if (!card || !glare) {
			return;
		}

		const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
		const supportsHover = window.matchMedia("(hover: hover) and (pointer: fine)");

		if (prefersReducedMotion.matches || !supportsHover.matches) {
			return;
		}

		let frame = 0;
		let nextTransform = "rotateX(0deg) rotateY(0deg)";
		let nextShadow = "0 24px 36px rgba(15, 23, 42, 0.18)";
		let nextGlareOpacity = "0";
		let nextGlareBackground = "none";
		const maxRotation = 5;

		const apply = () => {
			frame = 0;
			card.style.transform = nextTransform;
			card.style.boxShadow = nextShadow;
			glare.style.opacity = nextGlareOpacity;
			glare.style.background = nextGlareBackground;
		};

		const queueApply = () => {
			if (frame === 0) {
				frame = window.requestAnimationFrame(apply);
			}
		};

		const reset = () => {
			nextTransform = "rotateX(0deg) rotateY(0deg)";
			nextShadow = "0 24px 36px rgba(15, 23, 42, 0.18)";
			nextGlareOpacity = "0";
			nextGlareBackground = "none";
			queueApply();
		};

		const handlePointerMove = (event: PointerEvent) => {
			const rect = card.getBoundingClientRect();
			const x = event.clientX - rect.left;
			const y = event.clientY - rect.top;
			const centerX = rect.width / 2;
			const centerY = rect.height / 2;
			const rotateY = -((x - centerX) / centerX) * maxRotation;
			const rotateX = -((centerY - y) / centerY) * maxRotation;
			const glareX = (x / rect.width) * 100;
			const glareY = (y / rect.height) * 100;

			nextTransform = `rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg)`;
			nextShadow = `${(rotateY * 1.5).toFixed(2)}px ${(-rotateX * 2).toFixed(2)}px 34px rgba(15, 23, 42, 0.18)`;
			nextGlareOpacity = "0.18";
			nextGlareBackground = `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.32), transparent 58%)`;
			queueApply();
		};

		card.addEventListener("pointermove", handlePointerMove);
		card.addEventListener("pointerleave", reset);
		card.addEventListener("pointercancel", reset);

		return () => {
			card.removeEventListener("pointermove", handlePointerMove);
			card.removeEventListener("pointerleave", reset);
			card.removeEventListener("pointercancel", reset);

			if (frame !== 0) {
				window.cancelAnimationFrame(frame);
			}
		};
	}, []);

	return (
		<div className="contact-card-scene">
			<div
				ref={cardRef}
				className="contact-card">
				<div
					ref={glareRef}
					aria-hidden
					className="contact-card__glare"
				/>
				<Image
					src={micImage}
					alt={contactCardCopy.studioImageAlt}
					width={1600}
					height={1836}
					layout="constrained"
					className="contact-card__image h-auto w-full object-cover"
				/>
				<div className="contact-card__content absolute inset-x-0 bottom-0 px-6 py-6 sm:px-8 sm:py-8">
					<h1 className="text-3xl font-bold tracking-tight md:text-4xl">{contactCardCopy.title}</h1>

					<dl
						aria-label={contactCardCopy.contactInfoAriaLabel}
						className="mt-1 grid gap-2 md:mt-6">
						{directContactItems.map((item) => (
							<div
								key={item.href}
								className="grid gap-1">
								<dt className="text-base font-medium text-foreground/70 md:text-lg">
									{item.label}
								</dt>
								<dd className="min-w-0">
									<a
										href={item.href}
										className="contact-link block text-base font-medium wrap-break-word md:text-lg">
										{item.value}
									</a>
								</dd>
							</div>
						))}
					</dl>
				</div>
			</div>
		</div>
	);
}

function ContactFaqSection() {
	return (
		<section
			aria-labelledby="contact-faq-title"
			className="mx-auto mt-16 w-full max-w-6xl">
			<h2
				id="contact-faq-title"
				className="text-3xl font-bold tracking-tight text-balance md:text-4xl">
				{faqSectionCopy.title}
			</h2>

			<div className="mt-4">
				{contactFaqItems.map((item) => (
					<ContactFaqItemRow
						key={item.question}
						item={item}
					/>
				))}
			</div>
		</section>
	);
}

function ContactFaqItemRow({ item }: { item: ContactFaqItem }) {
	const [isOpen, setIsOpen] = useState(false);
	const contentId = `contact-faq-${item.question.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;

	return (
		<div className="border-b border-border last:border-b-0">
			<button
				type="button"
				className="flex w-full items-start justify-between gap-4 py-5 text-left text-base font-semibold text-foreground transition-colors duration-150 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:items-center md:py-6"
				aria-controls={contentId}
				aria-expanded={isOpen}
				onClick={() => {
					setIsOpen((current) => !current);
				}}>
				<span className="leading-snug">{item.question}</span>
				<ChevronDown
					aria-hidden
					className={cn(
						"mt-0.5 shrink-0 transition-transform duration-200 md:mt-0",
						isOpen ? "rotate-180 text-foreground" : "text-muted-foreground",
					)}
				/>
			</button>

			<div
				id={contentId}
				hidden={!isOpen}
				className="max-w-5xl pb-5 text-sm leading-7 text-pretty text-muted-foreground md:pb-6 md:text-base">
				{item.answerParts.map((part, index) => {
					if (part.type === "text") {
						return <span key={`${item.question}-text-${index}`}>{part.value}</span>;
					}

					if (part.type === "email") {
						return (
							<a
								key={`${item.question}-email-${index}`}
								href={`mailto:${env.VITE_APP_CONTACT_EMAIL}`}
								className="text-foreground underline decoration-primary/65 underline-offset-4 transition-colors duration-150 hover:text-primary">
								{env.VITE_APP_CONTACT_EMAIL}
							</a>
						);
					}

					return (
						<a
							key={`${item.question}-phone-${index}`}
							href={`tel:${env.VITE_APP_CONTACT_PHONE}`}
							className="text-foreground underline decoration-primary/65 underline-offset-4 transition-colors duration-150 hover:text-primary">
							{env.VITE_APP_CONTACT_PHONE}
						</a>
					);
				})}
			</div>
		</div>
	);
}
