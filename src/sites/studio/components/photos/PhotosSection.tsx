import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { cn } from "#/lib/utils";
import { ContactActions } from "#studio/components/contact/ContactActions";
import { ImageViewer, ImageViewerTrigger } from "#studio/components/photos/ImageViewer";
import { photosPageContent, type PhotoGalleryImage } from "#studio/content/photos";
import { landingSectionHeadingClassName } from "#studio/lib/landing-styles";
import { useFadeInAnimation } from "#studio/hooks/useFadeInAnimation";

export interface PhotosSectionProps {
	className?: string;
	headingLevel?: "h1" | "h2";
	images?: PhotoGalleryImage[];
	mobileImages?: PhotoGalleryImage[];
	fadeIn?: boolean;
	layout?: "masonry" | "threeFeature";
}

export function PhotosSection({
	className,
	headingLevel = "h2",
	images = photosPageContent.galleryImages,
	mobileImages,
	fadeIn = false,
	layout = "masonry"
}: PhotosSectionProps) {
	const [isMobile, setIsMobile] = useState(false);
	const [previewImage, setPreviewImage] = useState<PhotoGalleryImage | null>(null);
	const fadeInAnimation = useFadeInAnimation(fadeIn);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(max-width: 767px)");
		const updateIsMobile = () => setIsMobile(mediaQuery.matches);

		updateIsMobile();
		mediaQuery.addEventListener("change", updateIsMobile);

		return () => mediaQuery.removeEventListener("change", updateIsMobile);
	}, []);

	const galleryImages = isMobile && mobileImages ? mobileImages : images;
	const heading =
		headingLevel === "h1" ? (
			<h1 className={landingSectionHeadingClassName}>{photosPageContent.title}</h1>
		) : (
			<h2 className={landingSectionHeadingClassName}>{photosPageContent.title}</h2>
		);

	return (
		<section className={cn("px-4 pb-16 md:px-12 lg:px-24 xl:px-32 2xl:px-48", className)}>
			<motion.div {...fadeInAnimation}>
				<div className="mx-auto flex w-full flex-col items-center gap-8 md:gap-10">
					<div className="max-w-4xl space-y-4 text-left md:text-center">
						{heading}
						<p className="text-pretty text-base leading-7 text-muted-foreground md:text-lg">
							{photosPageContent.lead}
						</p>
					</div>
					<div
						className={cn(
							"w-full",
							layout === "threeFeature"
								? "flex flex-col gap-6 lg:flex-row"
								: "columns-1 gap-6 sm:columns-2 xl:columns-3"
						)}>
						{galleryImages.map((image, index) => (
							<figure
								key={image.src}
								className={cn(
									layout === "threeFeature"
										? "lg:flex-1"
										: "mb-6 break-inside-avoid overflow-hidden rounded-lg bg-card shadow-xl shadow-background/40"
								)}>
								<ImageViewerTrigger
									image={image}
									loading={index < 3 ? "eager" : "lazy"}
									imageClassName="block h-auto w-full"
									className={cn(layout === "threeFeature" && "shadow-xl shadow-background/40")}
									onSelect={setPreviewImage}
								/>
								{layout === "threeFeature" && image.caption ? (
									<figcaption className="pt-3 text-center text-base text-foreground md:text-lg">
										{image.caption}
									</figcaption>
								) : null}
							</figure>
						))}
					</div>
				</div>
				<ContactActions className="max-w-3xl" />
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
