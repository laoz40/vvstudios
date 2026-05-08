import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "#/components/ui/button";
import { studioSite } from "#/config/sites";

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
};

const pricingPageCopy = {
	title: "Studio session pricing",
	lead: "Each session comes with a fully prepared studio for creators who want their content to look and sound proffesional. Includes three 4K Sony cameras, up to four RØDE PodMics, and cinematic overhead lighting.",
	addOnsTitle: "Production add-ons",
	bookSessionLabel: "Book session",
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
		label: "4K UHD recording",
		price: "$49",
		description: "Our highest quality recording, perfect for cropping without losing clarity.",
	},
	{
		label: "Essential Edit",
		price: "$99",
		description: "Professionally synchronised audio with clean cuts between camera angles.",
	},
	{
		label: "Clips Package",
		price: "$79",
		description: "10 clips with subtitles and vertical cropping ready for social media.",
	},
];

export type PricingSectionProps = {
	headingLevel?: "h1" | "h2";
	className?: string;
	compact?: boolean;
};

export function PricingSection({
	headingLevel = "h2",
	className,
	compact = false,
}: PricingSectionProps) {
	const HeadingTag = headingLevel;

	return (
		<section
			className={["px-4 pb-16 sm:pb-20", compact ? "pt-16 md:pt-20" : "pt-28 md:pt-32", className]
				.filter(Boolean)
				.join(" ")}>
			<div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8">
				<div className="flex max-w-4xl flex-col items-center gap-5 pb-2 text-center">
					<HeadingTag className="font-brand text-[2.5rem] leading-none tracking-tight text-balance uppercase md:text-6xl">
						{pricingPageCopy.title}
					</HeadingTag>
					<p className="text-muted-foreground text-base text-pretty leading-7 md:text-lg">
						{pricingPageCopy.lead}
					</p>
				</div>

				<div className="grid gap-7 sm:gap-5 lg:grid-cols-3">
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
								<h3 className="text-foreground text-base font-semibold">{session.label}</h3>
								<p className="text-4xl leading-none sm:text-4xl">{session.price}</p>
								<div className="min-h-6">
									{session.savings ? (
										<div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
											<p className="text-muted-foreground">
												<span className="line-through">{session.baseRatePrice}</span>
												<span> standard rate</span>
											</p>
											<p className="text-primary font-semibold">{session.savings}</p>
										</div>
									) : (
										<p className="text-muted-foreground text-xs">Standard rate</p>
									)}
								</div>

								<p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
									{session.description}
								</p>

								<div className="mt-auto pt-6 sm:pt-8">
									<Button
										asChild
										size="lg"
										className="w-full justify-center gap-1.5 text-base font-medium shadow-lg shadow-primary/45">
										<Link to={studioSite.routes.book}>
											{pricingPageCopy.bookSessionLabel}
											<ArrowRight
												className="translate-y-px stroke-3"
												aria-hidden
											/>
										</Link>
									</Button>
								</div>
							</div>
						</article>
					))}
				</div>

				<div className="mt-8 space-y-4">
					<section className="space-y-12">
						<div className="text-center">
							<h2 className="font-brand text-3xl leading-none uppercase md:text-4xl">
								{pricingPageCopy.addOnsTitle}
							</h2>
						</div>

						<div className="grid gap-8 md:grid-cols-3 md:gap-18">
							{pricingAddOns.map((addOn) => (
								<div
									key={addOn.label}
									className="flex h-full w-full max-w-xs flex-col gap-3">
									<div className="flex items-start justify-between md:justify-start gap-2">
										<h3 className="text-base font-medium">{addOn.label}</h3>
										<p className="text-primary text-base font-medium">{addOn.price}</p>
									</div>
									<p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
										{addOn.description}
									</p>
								</div>
							))}
						</div>
					</section>
				</div>
			</div>
		</section>
	);
}
