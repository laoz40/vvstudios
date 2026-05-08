import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { ArrowRight } from "lucide-react";
import { useEffect, useRef } from "react";
import micImage from "#studio/assets/mic.webp";
import { FreeTourDialogButton } from "#studio/components/FreeTourDialog";
import { FaqSection } from "#studio/components/faq/FaqSection";
import { Button } from "#/components/ui/button";
import { studioSite } from "#/config/sites";
import { env } from "#/env";

const contactCardCopy = {
	title: "Contact",
	contactInfoAriaLabel: "Contact information",
	studioImageAlt: "Podcast studio microphone setup at VV Studios Sydney",
} as const;

const contactItems = [
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
			<div className="mx-auto mt-7 flex w-full max-w-4xl flex-wrap justify-center gap-4 md:mt-12 md:gap-6">
				<Button
					asChild
					size="lg"
					className="h-auto min-w-56 flex-1 basis-full gap-1.5 px-8 py-3 text-base font-medium shadow-lg shadow-primary/45 md:basis-0">
					<Link to={studioSite.routes.book}>
						{contactActionCopy.bookCta}
						<ArrowRight
							className="translate-y-px stroke-3"
							aria-hidden
						/>
					</Link>
				</Button>
				<FreeTourDialogButton
					label={contactActionCopy.tourCta}
					className="h-auto min-w-56 flex-1 basis-full border-0 px-8 py-3 text-base font-medium! shadow-md shadow-background/25 md:basis-0"
				/>
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
		const supportsCardHover = window.matchMedia(
			"(min-width: 640px) and (hover: hover) and (pointer: fine)",
		);

		if (prefersReducedMotion.matches || !supportsCardHover.matches) {
			return;
		}

		let frame = 0;
		let nextTransform = "rotateX(0deg) rotateY(0deg)";
		let nextGlareOpacity = "0";
		let nextGlareBackground = "none";
		const maxRotation = 5;

		const apply = () => {
			frame = 0;
			card.style.transform = nextTransform;
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
					<h1 className="font-brand text-4xl tracking-tight md:text-6xl uppercase">
						{contactCardCopy.title}
					</h1>

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
		<FaqSection
			id="contact-faq-title"
			className="mx-auto mt-16 w-full max-w-6xl"
		/>
	);
}
