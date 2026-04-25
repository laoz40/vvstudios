import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { useEffect, useRef } from "react";
import micImage from "#/assets/mic.webp";
import { FreeTourDialogButton } from "#/components/FreeTourDialog";
import { FaqSection } from "#/components/faq/FaqSection";
import { Button } from "#/components/ui/button";
import { Separator } from "#/components/ui/separator";
import { env } from "#/env";

const contactCardCopy = {
	title: "Contact",
	contactInfoAriaLabel: "Contact information",
	studioImageAlt: "Studio microphone",
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
			<Separator className="mx-auto my-4 max-w-6xl" />
			<div className="mx-auto mt-7 flex max-w-6xl flex-wrap gap-4 sm:gap-3 md:mt-12">
				<Button
					asChild
					size="lg"
					className="min-w-64 flex-1 border-2 border-primary px-4 py-5 text-base font-semibold sm:px-8">
					<Link to="/book">{contactActionCopy.bookCta}</Link>
				</Button>
				<FreeTourDialogButton
					label={contactActionCopy.tourCta}
					className="min-w-64 flex-1 border-2 px-4 py-5 text-base font-semibold sm:px-8"
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
		<FaqSection
			id="contact-faq-title"
			className="mx-auto mt-16 w-full max-w-6xl"
		/>
	);
}
