import { useState } from "react";
import { motion } from "motion/react";
import { cn } from "#/lib/utils";
import behindTheScenesWideImage from "#studio/assets/gallery/behind-the-scenes-wide.webp";
import { ContactActions } from "#studio/components/contact/ContactActions";
import { FaqItemsAccordion } from "#studio/components/faq/FaqItemsAccordion";
import { faqSectionCopy } from "#studio/components/faq/faq-section-copy";
import { ImageViewer, ImageViewerTrigger } from "#studio/components/photos/ImageViewer";
import type { PhotoGalleryImage } from "#studio/content/photos";
import { useFadeInAnimation } from "#studio/hooks/useFadeInAnimation";
import {
	landingSectionContentGapClassName,
	landingSectionHeadingAfterClassName,
	landingSectionHeadingClassName
} from "#studio/lib/landing-styles";

export { faqSectionCopy } from "#studio/components/faq/faq-section-copy";

const faqImage: PhotoGalleryImage = {
	src: behindTheScenesWideImage,
	alt: "Behind the scenes view of VV Studios podcast studio hire space in Sydney",
	width: 1971,
	height: 1110
};

export type FaqSectionProps = { fadeIn?: boolean };

export function FaqSection({ fadeIn = true }: FaqSectionProps) {
	const fadeInAnimation = useFadeInAnimation(fadeIn);
	const [previewImage, setPreviewImage] = useState<PhotoGalleryImage | null>(null);

	return (
		<section
			aria-labelledby="faq-title"
			className="px-4 pb-16 md:px-12 md:pb-20 lg:px-24 xl:px-32 2xl:px-48">
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
						"grid md:grid-cols-2 md:items-start",
						landingSectionContentGapClassName,
						landingSectionHeadingAfterClassName,
						"w-full"
					)}>
					<div
						className={cn(
							"order-2 flex flex-col md:order-1",
							landingSectionContentGapClassName,
							"w-full"
						)}>
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

						<ContactActions className="mt-0 md:mt-0 md:justify-start" />
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
