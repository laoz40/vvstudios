import { useState, type ComponentProps, type ComponentType } from "react";
import { Link } from "@tanstack/react-router";
import { motion } from "motion/react";
import {
	Globe,
	Scissors,
	ScrollText,
	Smartphone,
	Sparkles,
	Video,
	WandSparkles
} from "lucide-react";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import { studioSite } from "#/config/sites";
import { cn } from "#/lib/utils";
import manAndWomanImage from "#studio/assets/gallery/man-and-woman.webp";
import timelineImage from "#studio/assets/gallery/timeline.webp";
import { ImageViewer, ImageViewerTrigger } from "#studio/components/photos/ImageViewer";
import type { PhotoGalleryImage } from "#studio/content/photos";
import {
	ADDON_PRICES,
	formatBookingPrice
} from "#studio/features/booking-form/lib/booking-pricing";
import { landingSectionHeadingClassName } from "#studio/lib/landing-styles";
import { useFadeInAnimation } from "#studio/hooks/useFadeInAnimation";

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
	lead: "Each session comes with a fully prepared studio for creators who want their content to look and sound professional. Includes three 4K Sony cameras, up to four RØDE PodMics, and cinematic overhead lighting.",
	addOnsTitle: "Production add-ons",
	editingServicesTitle: "Editing services",
	bookSessionLabel: "Book session",
	bookingDepositNote:
		"Only $50 booking deposit required to secure your time slot, which gets deducted from your total."
} as const;

const pricingSessions: readonly PricingSession[] = [
	{
		label: "1 Hour",
		price: "$200",
		baseRatePrice: "$200",
		description:
			"Quick focused recording window. Best for solo episodes, voiceovers or short interviews."
	},
	{
		label: "2 Hours",
		price: "$299",
		baseRatePrice: "$400",
		savings: "Save $101",
		description: "Balanced session for interviews, business podcasts and longer conversations.",
		isMostPopular: true
	},
	{
		label: "3 Hours",
		price: "$399",
		baseRatePrice: "$600",
		savings: "Save $201",
		description: "Extended time for deeper interviews, multiple guests or content batching."
	}
];

const productionAddOns: readonly PricingAddOn[] = [
	{
		label: "Remote Podcast",
		price: formatBookingPrice(ADDON_PRICES["Remote Podcast"]),
		description:
			"Record with guests anywhere in the world through Riverside.fm, while you get the professional studio look and cinematic lighting in your own recording.",
		icon: Globe
	},
	{
		label: "4K UHD recording",
		price: formatBookingPrice(ADDON_PRICES["4K UHD Recording"]),
		description:
			"Our highest quality recording option. Ideal if you want extra clarity in the final video or plan to crop footage for social media without losing quality.",
		icon: Video
	},
	{
		label: "Teleprompter",
		price: formatBookingPrice(ADDON_PRICES.Teleprompter),
		description:
			"Your script sits in front of the camera so you can read while looking at the lens. Useful for scripted episodes, ads, and talking-head content.",
		icon: ScrollText
	}
];

const editingAddOns: readonly PricingAddOn[] = [
	{
		label: "Essential Edit",
		price: formatBookingPrice(ADDON_PRICES["Essential Edit"]),
		description:
			"A clean edit of your full episode. We synchronise the audio and cut between camera angles so the final video feels smooth and ready to publish.",
		icon: Scissors
	},
	{
		label: "Complete Edit",
		price: formatBookingPrice(ADDON_PRICES["Complete Edit"]),
		description:
			"A fuller episode edit. We add a dynamic teaser, lower thirds and B-roll, and cut filler words and silences so the episode is closer to publish-ready.",
		icon: WandSparkles
	},
	{
		label: "Clip Volume Pack",
		price: formatBookingPrice(ADDON_PRICES["Clip Volume Pack"]),
		description:
			"Get 10 edited clips from your session, formatted for social media. Each clip includes subtitles and vertical cropping, so you can share key moments from the episode quickly.",
		icon: Smartphone
	},
	{
		label: "Handcrafted Clips",
		price: formatBookingPrice(ADDON_PRICES["Handcrafted Clips"]),
		description:
			"Get 5 premium clips from your session. Each clip includes animated subtitles, B-roll, and custom graphics for social posts that need more polish than the volume pack.",
		icon: Sparkles
	}
];

const productionAddOnsImage: PhotoGalleryImage = {
	src: manAndWomanImage,
	alt: "Man and woman recording at the VV Studios podcast studio table in Sydney",
	width: 1205,
	height: 1205
};

const editingAddOnsImage: PhotoGalleryImage = {
	src: timelineImage,
	alt: "Editing timeline for a VV Studios podcast session",
	width: 1600,
	height: 1600
};

type PricingAddonFeatureSectionProps = {
	title: string;
	addOns: readonly PricingAddOn[];
	image: PhotoGalleryImage;
	imageSide: "left" | "right";
	onSelectImage: (image: PhotoGalleryImage) => void;
};

function PricingAddonFeatureSection({
	title,
	addOns,
	image,
	imageSide,
	onSelectImage
}: PricingAddonFeatureSectionProps) {
	const imageOnLeft = imageSide === "left";

	return (
		<section className="grid w-full gap-10 md:grid-cols-2 md:items-stretch md:text-left">
			<ImageViewerTrigger
				image={image}
				className={cn(
					"relative h-80 w-full overflow-hidden md:h-full md:max-w-2xl",
					"rounded-lg bg-card",
					"shadow-xl shadow-background/40",
					imageOnLeft ? "md:order-1" : "md:order-2 md:justify-self-end"
				)}
				imageClassName="absolute inset-0 size-full object-cover object-center"
				onSelect={onSelectImage}
			/>

			<div
				className={cn(
					"flex w-full flex-col gap-8 text-left md:gap-12",
					imageOnLeft ? "md:order-2" : "md:order-1"
				)}>
				<h2 className="ml-0 font-brand text-3xl leading-none uppercase md:ml-16 md:text-5xl">
					{title}
				</h2>

				<div className="grid w-full gap-8 text-left md:gap-10">
					{addOns.map((addOn) => {
						const Icon = addOn.icon;

						return (
							<div
								key={addOn.label}
								className="flex h-full w-full gap-4">
								<div className="hidden w-12 shrink-0 items-center justify-center text-primary md:flex">
									<Icon
										aria-hidden="true"
										className="size-12"
									/>
								</div>
								<div className="flex min-w-0 flex-1 flex-col gap-1">
									<div className="flex items-start justify-between gap-2 md:justify-start">
										<h3 className="text-base font-medium">{addOn.label}</h3>
										<p className="text-primary text-base font-medium">{addOn.price}</p>
									</div>
									<p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
										{addOn.description}
									</p>
								</div>
							</div>
						);
					})}
				</div>
			</div>
		</section>
	);
}

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
	fadeIn = false
}: PricingSectionProps) {
	const [previewImage, setPreviewImage] = useState<PhotoGalleryImage | null>(null);
	const HeadingTag = headingLevel;
	const fadeInAnimation = useFadeInAnimation(fadeIn);

	return (
		<section
			className={cn(
				"px-4 pb-16 sm:pb-20 md:px-12 lg:px-24 xl:px-32 2xl:px-48",
				!compact && "pt-0",
				className
			)}>
			<motion.div
				className="flex w-full flex-col items-center gap-8 md:gap-12"
				{...fadeInAnimation}>
				<div
					className={cn(
						"flex w-full flex-col items-start md:items-center",
						"gap-4 pb-2 md:gap-5",
						"text-left md:text-center"
					)}>
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
							className={cn(
								"relative flex h-full flex-col rounded-lg border bg-card",
								"p-4 sm:px-5 sm:py-6",
								"shadow-xl",
								session.isMostPopular ? "border-primary" : "border-border"
							)}>
							{session.isMostPopular ? (
								<span
									className={cn(
										"absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2",
										"inline-flex items-center rounded-md",
										"px-3 py-1",
										"text-xs font-bold tracking-wide whitespace-nowrap uppercase",
										"bg-primary text-primary-foreground"
									)}>
									Most popular
								</span>
							) : null}
							<div className="flex flex-1 flex-col space-y-2">
								<h3 className="text-lg font-semibold text-foreground sm:text-2xl">
									{session.label}
								</h3>
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

								<p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
									{session.description}
								</p>

								<div className="mt-auto pt-6 sm:pt-8">
									<AnimatedIconButton
										className={cn(
											"w-full justify-center gap-1.5 py-5",
											"text-base font-medium",
											"shadow-lg shadow-primary/45"
										)}
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

				<div className="mt-8 flex w-full flex-col gap-16 md:mt-24 md:gap-24">
					<PricingAddonFeatureSection
						title={pricingPageCopy.addOnsTitle}
						addOns={productionAddOns}
						image={productionAddOnsImage}
						imageSide="left"
						onSelectImage={setPreviewImage}
					/>
					<PricingAddonFeatureSection
						title={pricingPageCopy.editingServicesTitle}
						addOns={editingAddOns}
						image={editingAddOnsImage}
						imageSide="right"
						onSelectImage={setPreviewImage}
					/>
				</div>
			</motion.div>
			<ImageViewer
				image={previewImage}
				onClose={() => {
					setPreviewImage(null);
				}}
			/>
		</section>
	);
}
