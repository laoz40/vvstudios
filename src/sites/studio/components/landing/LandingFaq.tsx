import { Image } from "@unpic/react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from "#/components/ui/accordion";
import behindTheScenesWideImage from "#studio/assets/gallery/behind-the-scenes-wide.webp";
import { ContactActions } from "#studio/components/contact/ContactActions";
import { faqSectionCopy, FaqSection } from "#studio/components/faq/FaqSection";

export type LandingFaqProps = { id?: string };

export function LandingFaq({ id = "faq-title" }: LandingFaqProps) {
	return (
		<FaqSection
			id={id}
			className="px-4 pb-16 md:px-12 md:pb-20 lg:px-24 xl:px-32 2xl:px-48"
			containerClassName="w-full"
			fadeIn>
			<div className="mt-6 grid w-full gap-10 md:mt-10 md:grid-cols-2 md:items-start">
				<div className="order-2 flex w-full flex-col gap-6 md:order-1">
					<div className="h-80 overflow-hidden rounded-lg bg-card shadow-xl shadow-background/40 md:h-128">
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

					<ContactActions className="mt-7 md:mt-0 md:justify-start" />
				</div>

				<Accordion
					type="single"
					collapsible
					className="order-1 w-full md:order-2">
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
