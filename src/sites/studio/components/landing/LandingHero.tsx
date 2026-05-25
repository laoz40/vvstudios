import { useRef, type CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, MapPin } from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import heroVideoMp4 from "#studio/assets/bg/landing.mp4";
import heroVideoWebm from "#studio/assets/bg/landing.webm";
import heroPoster from "#studio/assets/bg/landing-poster.webp";
import heroMobile from "#studio/assets/bg/mobile.webp";
import { FreeTourDialogButton } from "#studio/components/FreeTourDialog";
import { Button } from "#/components/ui/button";
import { STUDIO_ADDRESS_URL } from "#/config/contact";
import { studioSite } from "#/config/sites";

const heroCopy = {
	eyebrow: "From Vertigo Visuals",
	title: "Hire The Top Studio in South West Sydney",
	lead: "A space to focus on your business or craft. You bring the idea, and we'll make it a reality.",
	bookCta: "Book session",
	tourCta: "Take free tour",
	addressLabel: "23 Fields Rd, Macquarie Fields NSW",
} as const;

const mobileBackgroundStyle = {
	"--landing-hero-mobile-background": `url(${heroMobile})`,
} as CSSProperties;

export function LandingHero() {
	const heroRef = useRef<HTMLElement>(null);
	const prefersReducedMotion = useReducedMotion();
	const { scrollYProgress } = useScroll({
		target: heroRef,
		offset: ["start start", "center start"],
	});
	const heroVideoY = useTransform(scrollYProgress, [0, 1], [0, -300]);
	const heroTextOpacity = useTransform(scrollYProgress, [0, 0.4], [1, 0]);
	const heroTextY = useTransform(scrollYProgress, [0, 0.4], [0, -180]);
	const heroTextBlur = useTransform(scrollYProgress, [0, 0.4], ["blur(0px)", "blur(10px)"]);

	return (
		<section
			ref={heroRef}
			aria-labelledby="landing-hero-title"
			className="landing-hero-scroll-space relative isolate w-full">
			<div className="sticky top-0 isolate h-svh overflow-hidden">
				<motion.div
					aria-hidden
					className="absolute inset-0 -z-20"
					style={{
						y: prefersReducedMotion ? 0 : heroVideoY,
					}}>
					<div
						className="landing-hero-mobile-background h-full w-full brightness-65 md:hidden"
						style={mobileBackgroundStyle}
					/>
					<video
						className="hidden h-full w-full object-cover brightness-65 md:block"
						autoPlay
						loop
						muted
						playsInline
						poster={heroPoster}
						preload="metadata">
						<source
							media="(min-width: 768px)"
							src={heroVideoWebm}
							type="video/webm"
						/>
						<source
							media="(min-width: 768px)"
							src={heroVideoMp4}
							type="video/mp4"
						/>
					</video>
				</motion.div>

				<div className="absolute inset-0 -z-10 bg-linear-to-br from-background/60 via-background/40 to-background/80" />

				<motion.div
					className="absolute inset-0 z-10"
					style={{
						filter: prefersReducedMotion ? "blur(0px)" : heroTextBlur,
						opacity: prefersReducedMotion ? 1 : heroTextOpacity,
						y: prefersReducedMotion ? 0 : heroTextY,
					}}>
					<div className="absolute inset-x-4 bottom-6 max-w-xl sm:bottom-12 md:right-auto md:bottom-32 md:left-20 lg:left-24 xl:left-50 xl:bottom-60">
						<div className="landing-hero-reveal flex flex-col gap-2 md:max-w-xl">
							<p className="text-primary text-xs font-semibold tracking-widest uppercase md:text-sm">
								{heroCopy.eyebrow}
							</p>
							<h1
								id="landing-hero-title"
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
									<Link to={studioSite.routes.book}>
										{heroCopy.bookCta}
										<ArrowRight
											className="translate-y-px stroke-3"
											aria-hidden
										/>
									</Link>
								</Button>

								<FreeTourDialogButton
									label={heroCopy.tourCta}
									className="h-auto flex-1 border-0 bg-card/50! px-8 py-3 text-base font-medium! shadow-md shadow-background/25 hover:bg-accent/80! md:flex-none"
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
									<a href={STUDIO_ADDRESS_URL}>{heroCopy.addressLabel}</a>
								</Button>
							</div>
						</div>
					</div>

					<div className="landing-hero-reveal landing-hero-reveal--delayed absolute right-8 bottom-8 left-auto hidden items-center gap-2 py-2 text-sm text-muted-foreground md:inline-flex md:text-base">
						<MapPin
							className="text-primary"
							aria-hidden
						/>
						<Button
							asChild
							variant="link"
							className="px-0 text-muted-foreground hover:text-foreground">
							<a href={STUDIO_ADDRESS_URL}>{heroCopy.addressLabel}</a>
						</Button>
					</div>
				</motion.div>
			</div>
		</section>
	);
}
