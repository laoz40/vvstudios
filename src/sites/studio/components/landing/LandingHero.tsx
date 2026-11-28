import type { CSSProperties } from "react";
import { Link } from "@tanstack/react-router";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import { studioSite } from "#/config/sites";
import { Button } from "#/components/ui/button";
import { MapPin } from "lucide-react";
import heroVideoMp4 from "#studio/assets/bg/landing.mp4";
import heroVideoWebm from "#studio/assets/bg/landing.webm";
import heroPoster from "#studio/assets/bg/landing-poster.webp";
import heroMobile from "#studio/assets/bg/mobile.webp";
import { FreeTourModalButton } from "#studio/components/FreeTourModal";
import { STUDIO_ADDRESS_URL } from "#/config/contact";

const heroCopy = {
	eyebrow: "Brought to you by Vertigo Visuals.",
	titleLineOne: "Hire The Top Studio",
	titleLineTwo: "South West Sydney",
	lead: "A space to focus on your business or craft. You bring the idea, and we'll make it a reality.",
	bookCta: "Book session",
	tourCta: "Take free tour",
	addressLabel: "23 Fields Rd, Macquarie Fields NSW"
} as const;

const mobileBackgroundStyle: CSSProperties & { "--landing-hero-mobile-background": string } = {
	"--landing-hero-mobile-background": `url(${heroMobile})`
};

export function LandingHero() {
	return (
		<section
			aria-labelledby="landing-hero-title"
			className="landing-hero-scroll-space relative isolate w-full">
			<div className="sticky top-0 isolate h-svh overflow-hidden md:h-dvh">
				<div
					aria-hidden
					className="landing-hero-mobile-background absolute inset-0 -z-20 brightness-65 md:hidden"
					style={mobileBackgroundStyle}
				/>
				<div
					aria-hidden
					className="landing-hero-video-parallax absolute inset-0 -z-20 hidden md:block">
					<video
						aria-label="Studio showcase background"
						className="h-full w-full object-cover brightness-65"
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
				</div>

				<div className="absolute inset-0 -z-10 bg-linear-to-br from-background/60 via-background/40 to-background/80" />

				<div className="absolute inset-0 z-10">
					<div className="landing-hero-text-scroll absolute inset-x-4 bottom-6 max-w-xl will-change-transform sm:bottom-12 md:right-auto md:bottom-32 md:left-10 md:max-w-3xl lg:left-12 xl:bottom-60 xl:left-25">
						<div className="landing-hero-reveal flex flex-col">
							<h1
								id="landing-hero-title"
								className="font-brand text-[2.9rem] leading-11 tracking-tight text-balance uppercase md:text-8xl md:leading-none">
								<span className="block">
									{heroCopy.titleLineOne}
									<span className="hidden md:inline"> in</span>
								</span>
								<span className="block">
									<span className="md:hidden">in </span>
									{heroCopy.titleLineTwo}
								</span>
							</h1>
							<p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground md:text-base">
								{heroCopy.lead}
							</p>

							<div className="mt-6 flex w-full flex-wrap gap-3">
								<AnimatedIconButton
									className="h-auto flex-1 gap-1.5 px-6! py-3 text-base font-medium shadow-lg shadow-primary/45 md:flex-none"
									icon={ArrowNarrowRightIcon}
									iconProps={{ size: 24, strokeWidth: 3, className: "translate-y-px" }}>
									<Link to={studioSite.routes.book}>{heroCopy.bookCta}</Link>
								</AnimatedIconButton>

								<FreeTourModalButton
									label={heroCopy.tourCta}
									className="h-auto flex-1 border-0 bg-card/50! px-8 py-3 text-base font-medium! shadow-md shadow-background/25 hover:bg-accent/80! md:flex-none"
								/>
							</div>
							{/*
							<p className="mt-8 text-xs tracking-wider text-muted-foreground md:text-sm">
								{heroCopy.eyebrow}
							</p>
*/}

							<div className="mt-16 inline-flex items-start gap-2 text-sm text-muted-foreground md:hidden">
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

					<div className="landing-hero-text-scroll absolute right-4 bottom-8 left-auto hidden py-2 text-sm text-muted-foreground md:block md:text-base">
						<div className="landing-hero-reveal landing-hero-reveal--delayed inline-flex items-center gap-2">
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
					</div>
				</div>
			</div>
		</section>
	);
}
