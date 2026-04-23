import { Link } from "@tanstack/react-router";
import { MapPin } from "lucide-react";
import heroDesktop from "#/assets/bg/landing.webp";
import heroMobile from "#/assets/bg/mobile.webp";
import { Button } from "#/components/ui/button";
import { env } from "#/env";

const heroCopy = {
	eyebrow: "From Vertigo Visuals",
	title: "The Best Studio in South West Sydney",
	lead: "A space to focus on your business or craft. We take care of the production from setup to final product.",
	bookCta: "Book session",
	tourCta: "Take free tour",
	addressLabel: "23 Fields Rd, Macquarie Fields NSW",
	backgroundAlt: "VV Podcast Studio interior with lights and set pieces",
} as const;

export function LandingHero() {
	return (
		<section
			aria-labelledby="landing-hero-title"
			className="relative isolate -mx-4 flex min-h-screen items-end overflow-hidden md:-mx-8 md:items-center lg:-mx-20">
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
						className="h-full w-full object-cover"
						decoding="async"
						fetchPriority="high"
						loading="eager"
					/>
				</picture>
			</div>

			<div className="absolute inset-0 -z-10 bg-gradient-to-br from-background/90 via-background/70 to-background/92" />

			<div className="mx-auto grid w-full max-w-6xl gap-4 px-4 pb-16 pt-36 md:px-0 md:pb-24 md:pt-32">
				<div className="flex max-w-xl flex-col gap-3">
					<p className="text-primary text-sm font-semibold tracking-widest uppercase">
						{heroCopy.eyebrow}
					</p>
					<h1
						id="landing-hero-title"
						className="max-w-sm text-4xl leading-tight font-bold tracking-tight text-balance md:max-w-xl md:text-6xl">
						{heroCopy.title}
					</h1>
					<p className="text-muted-foreground mt-4 max-w-sm text-base leading-relaxed text-pretty md:max-w-xl">
						{heroCopy.lead}
					</p>

					<div className="mt-6 flex w-full flex-wrap gap-3 md:mt-12">
						<Button
							asChild
							size="lg"
							className="flex-1 border-2 border-primary px-8 py-5 text-base font-semibold md:flex-none">
							<Link to="/book">{heroCopy.bookCta}</Link>
						</Button>

						<Button
							type="button"
							variant="outline"
							size="lg"
							className="flex-1 border-2 border-border/80 bg-background/60 px-8 py-5 text-base font-semibold hover:bg-background/75 md:flex-none">
							{heroCopy.tourCta}
						</Button>
					</div>

					<div className="mt-3 inline-flex items-start gap-2 text-sm text-muted-foreground md:hidden">
						<MapPin className="text-primary" />
						<Button
							asChild
							variant="link"
							className="h-auto px-0 py-0 text-left whitespace-normal text-muted-foreground hover:text-foreground">
							<a href={env.VITE_APP_STUDIO_ADDRESS_URL}>{heroCopy.addressLabel}</a>
						</Button>
					</div>
				</div>
			</div>

			<div className="absolute right-8 bottom-8 left-auto hidden items-center gap-2 py-2 text-sm text-muted-foreground md:inline-flex md:text-base">
				<MapPin className="text-primary" />
				<Button
					asChild
					variant="link"
					className="px-0 text-muted-foreground hover:text-foreground">
					<a href={env.VITE_APP_STUDIO_ADDRESS_URL}>{heroCopy.addressLabel}</a>
				</Button>
			</div>
		</section>
	);
}
