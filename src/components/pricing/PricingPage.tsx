import { Link } from "@tanstack/react-router";
import { Button } from "#/components/ui/button";

export type PricingSession = {
	label: string;
	price: string;
	baseRatePrice: string;
	savings?: string;
	description: string;
	isMostPopular?: boolean;
};

export type PricingAddOn = {
	label: string;
	price: string;
	description: string;
};

const pricingCopy = {
	title: "Studio session pricing",
	lead: "Pricing is based on session duration. You can choose either the table setup or armchair setup, with images available on the booking page.",
	addOnsTitle: "Production add-ons",
	addOnsLead:
		"Each session includes a fully prepared studio with three 4K Sony cameras, up to four RODE PodMic microphones, and cinematic lighting already set up.",
	bookSessionLabel: "Book session",
} as const;

const sessions: PricingSession[] = [
	{
		label: "1 Hour",
		price: "$200",
		baseRatePrice: "$200",
		description:
			"Professional podcast or video studio access for one hour with the table or armchair set, three Sony 4K cameras, up to four RODE PodMic microphones, and studio lighting included. Best for solo episodes or short interviews.",
	},
	{
		label: "2 Hours",
		price: "$299",
		baseRatePrice: "$400",
		savings: "Save $101",
		description:
			"Everything included in the one hour session, with extra time for longer interviews, more relaxed pacing, or multiple takes. Great for interviews and longer conversations.",
		isMostPopular: true,
	},
	{
		label: "3 Hours",
		price: "$399",
		baseRatePrice: "$600",
		savings: "Save $201",
		description:
			"Extended studio hire for longer recordings, multi-episode batching, or deeper production sessions with full use of the prepared studio setup. Ideal for deeper sessions or content batching.",
	},
];

const addOns: PricingAddOn[] = [
	{
		label: "4K UHD recording",
		price: "$49",
		description:
			"Upgrade your final video delivery from standard 1080p to 4K UHD for sharper footage and added flexibility in post-production.",
	},
	{
		label: "Video editing",
		price: "$99",
		description:
			"Receive a polished final edit with multi-camera cuts, pacing adjustments, and a clean export ready to publish.",
	},
	{
		label: "10 social media clips",
		price: "$79",
		description:
			"Get ten short-form clips formatted for social media so you can promote your episode across Instagram, TikTok, and similar platforms.",
	},
];

export function PricingPage() {
	return (
		<main>
			<section className="px-4 pt-4 pb-16 sm:pb-20 md:pt-8">
				<div className="mx-auto flex w-full max-w-6xl flex-col gap-12">
					<div className="max-w-3xl pb-2">
						<h1 className="text-2xl leading-none font-bold md:text-4xl">{pricingCopy.title}</h1>
						<p className="text-muted-foreground mt-4 text-sm leading-7 sm:text-base">
							{pricingCopy.lead}
						</p>
					</div>

					<div className="grid gap-5 lg:grid-cols-3">
						{sessions.map((session) => (
							<article
								key={session.label}
								className="bg-card flex h-full flex-col rounded-lg border p-6">
								<div className="flex flex-1 flex-col gap-6">
									<div>
										<div className="flex items-center justify-between gap-4">
											<h2 className="text-xl font-bold sm:text-2xl">{session.label}</h2>
											{session.isMostPopular ? (
												<span className="bg-primary text-primary-foreground inline-flex items-center rounded-md px-3 py-1 text-xs font-bold tracking-wide uppercase">
													Most popular
												</span>
											) : null}
										</div>
										<p className="text-primary mt-3 text-5xl leading-none font-bold sm:text-6xl">
											{session.price}
										</p>
										<div className="mt-3 min-h-6">
											{session.savings ? (
												<div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
													<p className="text-muted-foreground flex items-center gap-1">
														<span className="line-through">{session.baseRatePrice}</span>
														<span>standard rate</span>
													</p>
													<p className="text-primary font-semibold">{session.savings}</p>
												</div>
											) : null}
										</div>
									</div>

									<p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
										{session.description}
									</p>

									<div className="mt-auto pt-2">
										<Button
											asChild
											size="lg"
											className="w-full justify-center">
											<Link to="/book">{pricingCopy.bookSessionLabel}</Link>
										</Button>
									</div>
								</div>
							</article>
						))}
					</div>

					<section className="space-y-4">
						<div className="max-w-3xl">
							<h2 className="text-2xl leading-none font-bold md:text-4xl">
								{pricingCopy.addOnsTitle}
							</h2>
							<p className="text-muted-foreground mt-4 text-sm leading-7 sm:text-base">
								{pricingCopy.addOnsLead}
							</p>
						</div>

						<div className="grid gap-4 md:grid-cols-3">
							{addOns.map((addOn) => (
								<div
									key={addOn.label}
									className="bg-card flex h-full flex-col gap-3 rounded-lg border p-5">
									<div className="flex items-start justify-between gap-4">
										<h3 className="text-lg font-semibold">{addOn.label}</h3>
										<p className="text-primary text-lg font-semibold">{addOn.price}</p>
									</div>
									<p className="text-muted-foreground text-sm leading-relaxed sm:text-base">
										{addOn.description}
									</p>
								</div>
							))}
						</div>
					</section>
				</div>
			</section>
		</main>
	);
}
