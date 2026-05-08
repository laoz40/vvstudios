import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "#/components/ui/accordion";

type ContactFaqAnswerPart = {
	heading?: string;
	value: string;
};

type ContactFaqItem = {
	question: string;
	answerParts: readonly ContactFaqAnswerPart[];
};

export const faqSectionCopy: {
	readonly title: string;
	readonly items: readonly ContactFaqItem[];
} = {
	title: "Frequently Asked Questions",
	items: [
		{
			question: "Can I film content other than podcasts?",
			answerParts: [
				{
					value:
						"Yes. The studio is suitable for podcasts, marketing content, voiceovers and music recordings. If you have a specific idea in mind, the setup can be adjusted to suit your creative needs.",
				},
			],
		},
		{
			question: "What’s included when I book a session?",
			answerParts: [
				{
					value:
						"Each session includes a fully prepared space with three 4K Sony cameras, up to four RØDE PodMics, and cinematic overhead lighting.",
				},
			],
		},
		{
			question: "Is there a producer included?",
			answerParts: [
				{
					value:
						"Yes, every session provides an experienced AV producer who will guide you through the recording process so you can focus on what you do best.",
				},
			],
		},
		{
			question: "Do you offer editing and post-production?",
			answerParts: [
				{
					heading: "Essential Edit ($99) - ",
					value:
						"Syncs audio to video, enhances sound to a broadcast-ready level, and includes multi-camera switching based on the active speaker.",
				},
				{
					heading: "Clips Package ($79) - ",
					value:
						"10 curated clips (15-60s), selected for engagement potential, delivered in vertical format with subtitles for social media.",
				},
			],
		},
	],
} as const;

export type FaqSectionProps = {
	id: string;
	className?: string;
	containerClassName?: string;
};

export function FaqSection({ id, className, containerClassName }: FaqSectionProps) {
	return (
		<section
			aria-labelledby={id}
			className={className}>
			<div className={containerClassName}>
				<div className="mx-auto flex max-w-3xl flex-col items-center text-center">
					<h2
						id={id}
						className="font-brand text-[2.5rem] leading-none tracking-tight text-balance uppercase md:text-6xl">
						{faqSectionCopy.title}
					</h2>
				</div>

				<Accordion
					type="single"
					collapsible
					className="mx-auto mt-10 max-w-4xl">
					{faqSectionCopy.items.map((item) => (
						<AccordionItem
							key={item.question}
							value={item.question}>
							<AccordionTrigger>{item.question}</AccordionTrigger>
							<AccordionContent>
								{item.answerParts.map((part) => (
									<p
										key={`${item.question}-${part.heading ?? part.value}`}
										className={part.heading ? "first:mt-0 mt-4" : undefined}>
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
		</section>
	);
}
