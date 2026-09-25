import { useState } from "react";
import { motion } from "motion/react";
import { cn } from "#/lib/utils";
import { ContactActions } from "#studio/components/contact/ContactActions";
import { FaqItemsAccordion } from "#studio/components/faq/FaqItemsAccordion";
import { faqSectionCopy } from "#studio/components/faq/faq-section-copy";
import { ImageViewer, ImageViewerTrigger } from "#studio/components/photos/ImageViewer";
import { behindTheScenesWidePhoto, type PhotoGalleryImage } from "#studio/content/photos";
import { useFadeInAnimation } from "#studio/hooks/useFadeInAnimation";
import {
	landingSectionHeadingAfterClassName,
	landingSectionHeadingClassName,
	marketingPageHorizontalPaddingClassName
} from "#studio/lib/landing-styles";

export { faqSectionCopy } from "#studio/components/faq/faq-section-copy";

export type FaqSectionProps = { fadeIn?: boolean };

export function FaqSection({ fadeIn = true }: FaqSectionProps) {
	const fadeInAnimation = useFadeInAnimation(fadeIn);
	const [previewImage, setPreviewImage] = useState<PhotoGalleryImage | null>(null);

	return (
		<section
			aria-labelledby="faq-title"
			className={cn(marketingPageHorizontalPaddingClassName, "pb-16 md:pb-20")}>
			<motion.div
				className="w-full"
				{...fadeInAnimation}>
				<div className="mx-auto flex max-w-3xl flex-col items-start text-left md:items-center md:text-center">
					<h2
						id="faq-title"
						className={cn("scroll-mt-20 md:scroll-mt-28", landingSectionHeadingClassName)}>
						{faqSectionCopy.title}
					</h2>
				</div>

				<div
					className={cn(
						"grid w-full gap-10 md:grid-cols-2 md:items-start",
						landingSectionHeadingAfterClassName
					)}>
					<div className="order-2 flex w-full flex-col md:order-1">
						<ImageViewerTrigger
							image={behindTheScenesWidePhoto}
							onSelect={setPreviewImage}
							className="h-80 overflow-hidden rounded-lg bg-card shadow-xl shadow-background/40 md:h-128"
							imageClassName="h-full w-full object-cover"
						/>

						<ContactActions className="mt-4 md:mt-4 md:justify-start" />
					</div>

					<FaqItemsAccordion className="order-1 w-full md:order-2" />
				</div>
			</motion.div>
			<ImageViewer
				image={previewImage}
				onClose={() => {
					setPreviewImage(null);
				}}
			/>
		</section>
	);
}
