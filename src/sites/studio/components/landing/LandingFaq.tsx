import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "#/components/ui/accordion";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import { studioSite } from "#/config/sites";
import behindTheScenesWideImage from "#studio/assets/gallery/behind-the-scenes-wide.webp";
import { FreeTourDialogButton } from "#studio/components/FreeTourDialog";
import { faqSectionCopy, FaqSection } from "#studio/components/faq/FaqSection";

export type LandingFaqProps = {
	id?: string;
};

const contactActionCopy = {
	bookCta: "Book session",
	tourCta: "Take free tour",
} as const;

export function LandingFaq({ id = "faq-title" }: LandingFaqProps) {
	return (
		<FaqSection
			id={id}
			className="bg-background px-4 pb-16 md:px-12 md:pb-20 lg:px-24 xl:px-32 2xl:px-48"
			containerClassName="w-full"
			fadeIn>
			<div className="mt-10 grid w-full gap-10 md:grid-cols-2 md:items-start">
				<div className="flex w-full flex-col gap-6">
					<div className="hidden h-128 overflow-hidden rounded-lg bg-card shadow-xl shadow-background/40 md:block">
						<Image
							src={behindTheScenesWideImage}
							alt="Behind the scenes view of VV Studios podcast studio hire space in Sydney"
							layout="constrained"
							width={1971}
							height={1110}
							loading="lazy"
							className="h-full w-full object-cover"
						/>
					</div>

					<div className="mt-7 flex w-full flex-wrap justify-center gap-4 md:mt-0 md:justify-start md:gap-6">
						<AnimatedIconButton
							className="h-auto min-w-56 flex-1 basis-full gap-1.5 px-8 py-3 text-base font-medium shadow-lg shadow-primary/45 md:basis-0"
							renderIcon={(iconRef) => (
								<ArrowNarrowRightIcon
									ref={iconRef}
									size={24}
									strokeWidth={3}
									className="translate-y-px"
								/>
							)}>
							<Link to={studioSite.routes.book}>{contactActionCopy.bookCta}</Link>
						</AnimatedIconButton>
						<FreeTourDialogButton
							label={contactActionCopy.tourCta}
							className="h-auto min-w-56 flex-1 basis-full border-0 px-8 py-3 text-base font-medium! shadow-md shadow-background/25 md:basis-0"
						/>
					</div>
				</div>

				<Accordion
					type="single"
					collapsible
					className="w-full">
					{faqSectionCopy.items.map((item) => (
						<AccordionItem
							key={item.question}
							value={item.question}>
							<AccordionTrigger>{item.question}</AccordionTrigger>
							<AccordionContent>
								{item.answerParts.map((part) => (
									<p
										key={`${item.question}-${part.heading ?? part.value}`}
										className="first:mt-0 mt-4">
										{part.heading ? (
											<strong className="text-foreground">{part.heading} </strong>
										) : null}
										{part.value}
									</p>
								))}
							</AccordionContent>
						</AccordionItem>
					))}
				</Accordion>
			</div>
		</FaqSection>
	);
}
