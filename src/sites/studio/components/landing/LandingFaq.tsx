import { useState } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger
} from "#/components/ui/accordion";
import { cn } from "#/lib/utils";
import behindTheScenesWideImage from "#studio/assets/gallery/behind-the-scenes-wide.webp";
import { ContactActions } from "#studio/components/contact/ContactActions";
import { faqSectionCopy, FaqSection } from "#studio/components/faq/FaqSection";
import { ImageViewer, ImageViewerTrigger } from "#studio/components/photos/ImageViewer";
import type { PhotoGalleryImage } from "#studio/content/photos";

export type LandingFaqProps = { id?: string };

const faqImage: PhotoGalleryImage = {
	src: behindTheScenesWideImage,
	alt: "Behind the scenes view of VV Studios podcast studio hire space in Sydney",
	width: 1971,
	height: 1110
};

export function LandingFaq({ id = "faq-title" }: LandingFaqProps) {
	const [previewImage, setPreviewImage] = useState<PhotoGalleryImage | null>(null);

	return (
		<FaqSection
			id={id}
			className="px-4 pb-16 md:px-12 md:pb-20 lg:px-24 xl:px-32 2xl:px-48"
			containerClassName="w-full"
			fadeIn>
			<div className={cn("grid gap-10 md:grid-cols-2 md:items-start", "w-full", "mt-6 md:mt-10")}>
				<div className={cn("order-2 flex flex-col gap-6 md:order-1", "w-full")}>
					<ImageViewerTrigger
						image={faqImage}
						onSelect={setPreviewImage}
						className={cn(
							"overflow-hidden",
							"h-80 md:h-128",
							"rounded-lg bg-card",
							"shadow-xl shadow-background/40"
						)}
						imageClassName="h-full w-full object-cover"
					/>

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
			<ImageViewer
				image={previewImage}
				onClose={() => {
					setPreviewImage(null);
				}}
			/>
		</FaqSection>
	);
}
