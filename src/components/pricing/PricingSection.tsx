import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";

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
	lead: "Pricing is based on session duration. You can choose either the table setup or armchair setup.",
	addOnsTitle: "Production add-ons",
	addOnsLead:
		"Each session includes a fully prepared space with three 4K Sony cameras, up to four RØDE PodMics, and cinematic overhead lighting.",
	bookSessionLabel: "Book session",
} as const;

const pricingSessions: readonly PricingSession[] = [
	{
		label: "1 Hour",
		price: "$200",
		baseRatePrice: "$200",
		description: "Quick focused recording window. Best for solo episodes or short interviews.",
	},
	{
		label: "2 Hours",
		price: "$299",
		baseRatePrice: "$400",
		savings: "Save $101",
		description:
			"Balanced option for most projects. Great for interviews and longer conversations.",
		isMostPopular: true,
	},
	{
		label: "3 Hours",
		price: "$399",
		baseRatePrice: "$600",
		savings: "Save $201",
		description:
			"Extended time for deeper coverage. Ideal for deeper sessions or content batching.",
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
		description:
			"Includes 10 clips with subtitles and vertical cropping to make them social media ready.",
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
			className={["px-4 pb-16 sm:pb-20", compact ? "pt-8 md:pt-12" : "pt-28 md:pt-32", className]
				.filter(Boolean)
				.join(" ")}>
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
				<div className="max-w-3xl space-y-4 pb-2">
					<HeadingTag className="text-2xl leading-none font-bold md:text-4xl">
						{pricingPageCopy.title}
					</HeadingTag>
					<p className="text-muted-foreground text-sm text-pretty leading-7 sm:text-base">
						{pricingPageCopy.lead}
					</p>
				</div>

				<div className="grid gap-5 lg:grid-cols-3">
					{pricingSessions.map((session) => (
						<article
							key={session.label}
							className="border-border bg-card flex h-full flex-col rounded-lg border p-4 sm:p-6">
							<div className="flex flex-1 flex-col gap-4">
								<div className="space-y-2">
									<div className="flex items-center justify-between gap-4">
										<h2 className="text-foreground text-lg sm:text-lg">{session.label}</h2>
										{session.isMostPopular ? (
											<span className="bg-primary text-primary-foreground inline-flex items-center rounded-md px-3 py-1 text-xs font-bold tracking-wide uppercase">
												Most popular
											</span>
										) : null}
									</div>
									<p className="text-4xl leading-none sm:text-4xl">{session.price}</p>
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
								</div>

								<p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
									{session.description}
								</p>

								<div className="mt-auto pt-2">
									<Button
										asChild
										size="lg"
										className="w-full justify-center text-base font-medium">
										<Link to="/book">{pricingPageCopy.bookSessionLabel}</Link>
									</Button>
								</div>
							</div>
						</article>
					))}
				</div>

				<div className="mt-8 space-y-4">
					<section className="space-y-4">
						<div className="max-w-3xl space-y-4">
							<h2 className="text-xl leading-none font-bold md:text-2xl">
								{pricingPageCopy.addOnsTitle}
							</h2>
							<p className="text-muted-foreground text-sm text-pretty leading-7 sm:text-base">
								{pricingPageCopy.addOnsLead}
							</p>
						</div>

						<div className="grid gap-4 md:grid-cols-3">
							{pricingAddOns.map((addOn) => (
								<div
									key={addOn.label}
									className="border-border bg-card flex h-full flex-col gap-3 rounded-lg border p-5">
									<div className="flex items-start justify-between gap-4">
										<h3 className="text-base font-semibold">{addOn.label}</h3>
										<p className="text-primary text-base font-semibold">{addOn.price}</p>
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
