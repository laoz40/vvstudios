import { type ComponentProps, type ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { motion } from "motion/react";
import { Globe, Scissors, Smartphone, Video } from "lucide-react";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import { studioSite } from "#/config/sites";
import { cn } from "#/lib/utils";
import trioTalkingAtTableSetupImage from "#studio/assets/gallery/trio-talking-at-table-setup.webp";
import { landingSectionHeadingClassName } from "#studio/lib/landing-styles";
import { useFadeInAnimation } from "#studio/lib/useFadeInAnimation";

type PricingSession = {
	label: string;
	price: string;
	baseRatePrice: string;
	savings?: string;
	description: string;
	isMostPopular?: boolean;
};

type PricingAddOn = {
	label: string;
	price: string;
	description: string;
	icon: ComponentType<ComponentProps<"svg">>;
};

const pricingPageCopy = {
	title: "Session pricing",
	lead: "Each session comes with a fully prepared studio for creators who want their content to look and sound proffesional. Includes three 4K Sony cameras, up to four RØDE PodMics, and cinematic overhead lighting.",
	addOnsTitle: "Production add-ons",
	bookSessionLabel: "Book session",
	bookingDepositNote:
		"Only $50 booking deposit required to secure your time slot, which gets deducted from your total.",
} as const;

const pricingSessions: readonly PricingSession[] = [
	{
		label: "1 Hour",
		price: "$200",
		baseRatePrice: "$200",
		description:
			"Quick focused recording window. Best for solo episodes, voiceovers or short interviews.",
	},
	{
		label: "2 Hours",
		price: "$299",
		baseRatePrice: "$400",
		savings: "Save $101",
		description: "Balanced session for interviews, business podcasts and longer conversations.",
		isMostPopular: true,
	},
	{
		label: "3 Hours",
		price: "$399",
		baseRatePrice: "$600",
		savings: "Save $201",
		description: "Extended time for deeper interviews, multiple guests or content batching.",
	},
];

const pricingAddOns: readonly PricingAddOn[] = [
	{
		label: "Remote Podcast",
		price: "$59",
		description:
			"Record with guests anywhere in the world through Riverside.fm, while you get the professional studio look and cinematic lighting in your own recording.",
		icon: Globe,
	},
	{
		label: "4K UHD recording",
		price: "$49",
		description:
			"Our highest quality recording option. Ideal if you want extra clarity in the final video or plan to crop footage for social media without losing quality.",
		icon: Video,
	},
	{
		label: "Essential Edit",
		price: "$99",
		description:
			"A clean edit of your full episode. We synchronise the audio and cut between camera angles so the final video feels smooth and ready to publish.",
		icon: Scissors,
	},
	{
		label: "Clips Package",
		price: "$79",
		description:
			"Get 10 edited clips from your session, formatted for social media. Each clip includes subtitles and vertical cropping, so you can share key moments from the episode quickly.",
		icon: Smartphone,
	},
];

export type PricingSectionProps = {
	headingLevel?: "h1" | "h2";
	className?: string;
	compact?: boolean;
	fadeIn?: boolean;
};

export function PricingSection({
	headingLevel = "h2",
	className,
	compact = false,
	fadeIn = false,
}: PricingSectionProps) {
	const HeadingTag = headingLevel;
	const fadeInAnimation = useFadeInAnimation(fadeIn);

	return (
		<section
			className={cn(
				"px-4 pb-16 sm:pb-20 md:px-12 lg:px-24 xl:px-32 2xl:px-48",
				compact ? "" : "pt-0",
				className,
			)}>
			<motion.div
				className="flex w-full flex-col items-center gap-8 md:gap-12"
				{...fadeInAnimation}>
				<div className="flex w-full flex-col items-start gap-5 pb-2 text-left md:items-center md:text-center">
					<HeadingTag className={landingSectionHeadingClassName}>
						{pricingPageCopy.title}
					</HeadingTag>
					<p className="max-w-4xl text-base leading-7 text-pretty text-muted-foreground md:text-lg">
						{pricingPageCopy.lead}
					</p>
				</div>

				<div className="grid w-full gap-8 md:gap-6 lg:grid-cols-3">
					{pricingSessions.map((session) => (
						<article
							key={session.label}
							className={[
								"bg-card relative flex h-full flex-col rounded-lg border p-4 sm:px-5 sm:py-6 shadow-xl",
								session.isMostPopular ? "border-primary" : "border-border",
							]
								.filter(Boolean)
								.join(" ")}>
							{session.isMostPopular ? (
								<span className="bg-primary text-primary-foreground absolute top-0 left-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center rounded-md px-3 py-1 text-xs font-bold tracking-wide whitespace-nowrap uppercase">
									Most popular
								</span>
							) : null}
							<div className="flex flex-1 flex-col space-y-2">
								<h3 className="text-foreground text-lg sm:text-2xl font-semibold">{session.label}</h3>
								<p className="text-4xl leading-none sm:text-5xl">{session.price}</p>
								<div className="min-h-6">
									{session.savings ? (
										<div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
											<p className="text-muted-foreground">
												<span className="line-through">{session.baseRatePrice}</span>
												<span> standard rate</span>
											</p>
											<p className="text-primary font-semibold">{session.savings}</p>
										</div>
									) : (
										<p className="text-muted-foreground text-sm">Standard rate</p>
									)}
								</div>

								<p className="mt-2 text-muted-foreground text-sm leading-relaxed sm:text-base">
									{session.description}
								</p>

								<div className="mt-auto pt-6 sm:pt-8">
									<AnimatedIconButton
										className="w-full justify-center py-5 gap-1.5 text-base font-medium shadow-lg shadow-primary/45"
										renderIcon={(iconRef) => (
											<ArrowNarrowRightIcon
												ref={iconRef}
												aria-hidden="true"
												focusable="false"
												size={24}
												strokeWidth={3}
												className="translate-y-px"
											/>
										)}>
										<Link to={studioSite.routes.book}>{pricingPageCopy.bookSessionLabel}</Link>
									</AnimatedIconButton>
								</div>
							</div>
						</article>
					))}
				</div>

				<p className="self-stretch text-left text-base leading-snug text-muted-foreground italic md:text-center">
					{pricingPageCopy.bookingDepositNote}
				</p>

				<div className="mt-8 w-full space-y-4 md:mt-24">
					<section className="grid w-full gap-10 md:grid-cols-2 md:items-stretch md:text-left">
						<div className="flex w-full flex-col gap-8 md:gap-12 text-left">
							<h2 className="ml-0 md:ml-16 font-brand text-3xl leading-none uppercase md:text-5xl">
								{pricingPageCopy.addOnsTitle}
							</h2>

							<div className="grid w-full gap-8 text-left md:gap-10">
								{pricingAddOns.map((addOn) => {
									const Icon = addOn.icon;

									return (
										<div
											key={addOn.label}
											className="flex h-full w-full gap-4">
											<div className="hidden w-12 shrink-0 self-stretch items-center justify-center text-primary md:flex">
												<Icon
													aria-hidden="true"
													className="size-12"
												/>
											</div>
											<div className="min-w-0 flex-1 space-y-1">
												<div className="flex items-start justify-between gap-2 md:justify-start">
													<h3 className="text-base font-medium">{addOn.label}</h3>
													<p className="text-primary text-base font-medium">{addOn.price}</p>
												</div>
												<p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
													{addOn.description}
												</p>
											</div>
										</div>
									);
								})}
							</div>
						</div>

						<div className="relative hidden h-full w-full max-w-2xl justify-self-end overflow-hidden rounded-lg bg-card shadow-xl shadow-background/40 md:block">
							<Image
								src={trioTalkingAtTableSetupImage}
								alt="Trio talking at the VV Studios podcast studio table setup in Sydney"
								layout="constrained"
								width={1612}
								height={1612}
								loading="lazy"
								className="absolute inset-0 size-full object-cover object-bottom"
							/>
						</div>
					</section>
				</div>
			</motion.div>
		</section>
	);
}
