import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { cn } from "#/lib/utils";

const faqCopy = {
	title: "Frequently Asked Questions",
	items: [
		{
			question: "Do I need my own equipment?",
			answer:
				"No. The studio is fully set up with professional cameras, audio, and lighting. You can walk in and focus on your content.",
		},
		{
			question: "I’ve never recorded before, is that a problem?",
			answer:
				"Not at all. The setup is handled for you, so you can get comfortable quickly and focus on delivering your content.",
		},
		{
			question: "What’s included in a session?",
			answer:
				"Everything needed to record high-quality content is ready to go. If you need editing or specific outputs, that can be arranged as well.",
		},
		{
			question: "Can I use the space for content other than podcasts?",
			answer:
				"Yes. The studio is also used for interviews, marketing content, and branded video, depending on what you need to create.",
		},
	],
} as const;

export function LandingFaq() {
	return (
		<section
			aria-labelledby="faq-title"
			className="bg-background px-4 md:px-0">
			<div className="mx-auto max-w-6xl py-8 md:py-12">
				<h2
					id="faq-title"
					className="text-3xl font-bold tracking-tight text-balance md:text-4xl">
					{faqCopy.title}
				</h2>

				<div className="mt-4">
					{faqCopy.items.map((item) => (
						<FaqRow
							key={item.question}
							answer={item.answer}
							question={item.question}
						/>
					))}
				</div>
			</div>
		</section>
	);
}

function FaqRow({ question, answer }: { question: string; answer: string }) {
	const [isOpen, setIsOpen] = useState(false);
	const contentId = `${question.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-")}-answer`;

	return (
		<div className="border-b border-border last:border-b-0">
			<button
				type="button"
				className="flex w-full items-start justify-between gap-4 py-4 text-left text-base font-semibold text-foreground transition-colors duration-150 hover:text-primary md:items-center md:text-lg"
				aria-controls={contentId}
				aria-expanded={isOpen}
				onClick={() => {
					setIsOpen((current) => !current);
				}}>
				<span className="leading-snug">{question}</span>
				<ChevronDown
					aria-hidden
					className={cn(
						"mt-0.5 shrink-0 text-muted-foreground transition-transform duration-200 md:mt-0",
						isOpen ? "rotate-180 text-foreground" : undefined,
					)}
				/>
			</button>

			<div
				id={contentId}
				hidden={!isOpen}
				className="max-w-4xl pb-5 text-sm leading-7 text-pretty text-muted-foreground md:pb-6 md:text-base">
				{answer}
			</div>
		</div>
	);
}
