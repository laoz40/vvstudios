import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/utils";

type ContactFaqAnswerPart = {
	heading?: string;
	value: string;
};

type ContactFaqItem = {
	question: string;
	answerParts: readonly ContactFaqAnswerPart[];
};

const faqSectionCopy = {
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
	] satisfies readonly ContactFaqItem[],
} as const;

export type FaqSectionProps = {
	id: string;
	className?: string;
	containerClassName?: string;
};

export function FaqSection({ id, className, containerClassName }: FaqSectionProps) {
	const [openItemIndex, setOpenItemIndex] = useState<number | null>(null);

	return (
		<section
			aria-labelledby={id}
			className={className}>
			<div className={containerClassName}>
				<h2
					id={id}
					className="text-3xl font-bold tracking-tight text-balance md:text-4xl">
					{faqSectionCopy.title}
				</h2>

				<div className="mt-4">
					{faqSectionCopy.items.map((item, index) => (
						<FaqRow
							isOpen={openItemIndex === index}
							onToggle={() => {
								setOpenItemIndex((current) => (current === index ? null : index));
							}}
							key={item.question}
							item={item}
						/>
					))}
				</div>
			</div>
		</section>
	);
}

function FaqRow({
	item,
	isOpen,
	onToggle,
}: {
	item: ContactFaqItem;
	isOpen: boolean;
	onToggle: () => void;
}) {
	const contentId = `faq-${item.question.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}`;

	return (
		<div className="border-b border-border last:border-b-0">
			<button
				type="button"
				className="pressable flex w-full items-start justify-between gap-4 py-5 text-left text-base font-semibold text-foreground transition-colors duration-150 hover:text-primary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background md:items-center md:py-6"
				aria-controls={contentId}
				aria-expanded={isOpen}
				onClick={onToggle}>
				<span className="leading-snug">{item.question}</span>
				<ChevronDown
					aria-hidden
					className={cn(
						"mt-0.5 shrink-0 transition-transform duration-200 md:mt-0",
						isOpen ? "rotate-180 text-foreground" : "text-muted-foreground",
					)}
				/>
			</button>

			<div
				id={contentId}
				hidden={!isOpen}
				className="max-w-5xl pb-5 text-sm leading-7 text-pretty text-muted-foreground md:pb-6 md:text-base">
				{item.answerParts.map((part) => (
					<p
						key={`${item.question}-${part.heading ?? part.value}`}
						className={part.heading ? "first:mt-0 mt-4" : undefined}>
						{part.heading ? <strong className="text-foreground">{part.heading} </strong> : null}
						{part.value}
					</p>
				))}
			</div>
		</div>
	);
}
