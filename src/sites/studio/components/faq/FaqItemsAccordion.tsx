import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from "#/components/ui/accordion";
import { faqSectionCopy } from "#studio/components/faq/faq-section-copy";

type FaqItemsAccordionProps = { className?: string; items?: typeof faqSectionCopy.items };

export function FaqItemsAccordion({
	className,
	items = faqSectionCopy.items
}: FaqItemsAccordionProps) {
	return (
		<Accordion
			type="single"
			collapsible
			className={className}>
			{items.map((item) => (
				<AccordionItem
					key={item.question}
					value={item.question}>
					<AccordionTrigger>{item.question}</AccordionTrigger>
					<AccordionContent>
						{item.answerParts.map((part) => (
							<p
								key={`${item.question}-${part.heading ?? part.value}`}
								className="first:mt-0 mt-4">
								{part.heading ? <strong className="text-foreground">{part.heading} </strong> : null}
								{part.value}
							</p>
						))}
					</AccordionContent>
				</AccordionItem>
			))}
		</Accordion>
	);
}
