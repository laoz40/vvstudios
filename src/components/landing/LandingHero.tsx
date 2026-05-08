import { Link } from "@tanstack/react-router";
import { ArrowRight, MapPin } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import heroDesktop from "#/assets/bg/landing.webp";
import heroMobile from "#/assets/bg/mobile.webp";
import { FreeTourDialogButton } from "#/components/FreeTourDialog";
import { Button } from "#/components/ui/button";
import { env } from "#/env";

const heroCopy = {
	eyebrow: "From Vertigo Visuals",
	title: "Hire The Top Studio in South West Sydney",
	lead: "A space to focus on your business or craft. You bring the idea, and we'll make sure it's captured properly.",
	bookCta: "Book session",
	tourCta: "Take free tour",
	addressLabel: "23 Fields Rd, Macquarie Fields NSW",
	backgroundAlt: "Podcast studio hire Sydney interior with lights, sets and recording equipment",
} as const;

export function LandingHero() {
	const shouldReduceMotion = useReducedMotion();

	return (
		<section
			aria-labelledby="landing-hero-title"
			className="relative isolate min-h-svh overflow-hidden md:-mx-4 lg:-mx-6">
			<div
				aria-hidden
				className="absolute inset-0 -z-20">
				<picture>
					<source
						media="(min-width: 768px)"
						srcSet={heroDesktop}
					/>
					<img
						src={heroMobile}
						alt={heroCopy.backgroundAlt}
						width={900}
						height={1350}
						className="h-full w-full object-cover brightness-65"
						decoding="async"
						fetchPriority="high"
						loading="eager"
					/>
				</picture>
			</div>

			<div className="absolute inset-0 -z-10 bg-linear-to-br from-background/60 via-background/40 to-background/80" />

			<div className="absolute inset-x-4 bottom-6 z-10 max-w-xl sm:bottom-12 md:right-auto md:bottom-32 md:left-20 lg:left-24 xl:left-50 xl:bottom-60">
				<motion.div
					className="flex flex-col gap-2 md:max-w-xl"
					initial={{
						opacity: shouldReduceMotion ? 1 : 0,
						y: shouldReduceMotion ? 0 : 12,
						filter: shouldReduceMotion ? "blur(0px)" : "blur(6px)",
					}}
					animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
					transition={{
						duration: shouldReduceMotion ? 0 : 0.75,
						ease: "easeOut",
					}}>
					<p className="text-primary text-xs font-semibold tracking-widest uppercase md:text-sm">
						{heroCopy.eyebrow}
					</p>
					<h1
						id="landing-hero-title"
						//className="text-4xl leading-tight font-bold tracking-tight text-balance md:text-6xl">
						className="font-brand text-[2.75rem] leading-12 tracking-tight uppercase text-balance md:text-7xl md:leading-20">
						{heroCopy.title}
					</h1>
					<p className="text-muted-foreground mt-1 text-sm leading-relaxed text-pretty md:text-base md:mt-4 md:max-w-lg">
						{heroCopy.lead}
					</p>

					<div className="mt-4 flex w-full flex-wrap gap-3 md:mt-4">
						<Button
							asChild
							size="lg"
							className="h-auto flex-1 gap-1.5 px-8 py-3 text-base font-medium shadow-lg shadow-primary/45 md:flex-none">
							<Link to="/book">
								{heroCopy.bookCta}
								<ArrowRight
									className="translate-y-px stroke-3"
									aria-hidden
								/>
							</Link>
						</Button>

						<FreeTourDialogButton
							label={heroCopy.tourCta}
							className="h-auto flex-1 border-0 bg-card/90 px-8 py-3 text-base font-medium! shadow-md shadow-background/25 backdrop-blur-md md:flex-none"
						/>
					</div>

					<div className="mt-8 inline-flex items-start gap-2 text-sm text-muted-foreground md:hidden">
						<MapPin
							className="text-primary"
							aria-hidden
						/>
						<Button
							asChild
							variant="link"
							className="h-auto px-0 py-0 text-left whitespace-normal text-muted-foreground hover:text-foreground">
							<a href={env.VITE_APP_STUDIO_ADDRESS_URL}>{heroCopy.addressLabel}</a>
						</Button>
					</div>
				</motion.div>
			</div>

			<motion.div
				className="absolute right-8 bottom-8 left-auto hidden items-center gap-2 py-2 text-sm text-muted-foreground md:inline-flex md:text-base"
				initial={{
					opacity: shouldReduceMotion ? 1 : 0,
					filter: shouldReduceMotion ? "blur(0px)" : "blur(6px)",
				}}
				animate={{ opacity: 1, filter: "blur(0px)" }}
				transition={{
					duration: shouldReduceMotion ? 0 : 0.75,
					delay: shouldReduceMotion ? 0 : 0.15,
					ease: "easeOut",
				}}>
				<MapPin
					className="text-primary"
					aria-hidden
				/>
				<Button
					asChild
					variant="link"
					className="px-0 text-muted-foreground hover:text-foreground">
					<a href={env.VITE_APP_STUDIO_ADDRESS_URL}>{heroCopy.addressLabel}</a>
				</Button>
			</motion.div>
		</section>
	);
}
