import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import { studioSite } from "#/config/sites";
import { Image } from "@unpic/react";
import { motion } from "motion/react";
import { FreeTourDialogButton } from "#studio/components/FreeTourDialog";
import { photosPageContent, type PhotoGalleryImage } from "#studio/content/photos";
import { landingSectionHeadingClassName } from "#studio/lib/landing-styles";
import { useFadeInAnimation } from "#studio/lib/useFadeInAnimation";
import { cn } from "#/lib/utils";

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
	layout = "masonry",
}: PhotosSectionProps) {
	const [isMobile, setIsMobile] = useState(false);
	const fadeInAnimation = useFadeInAnimation(fadeIn);

	useEffect(() => {
		const mediaQuery = window.matchMedia("(max-width: 767px)");
		const updateIsMobile = () => setIsMobile(mediaQuery.matches);

		updateIsMobile();
		mediaQuery.addEventListener("change", updateIsMobile);

		return () => mediaQuery.removeEventListener("change", updateIsMobile);
	}, []);

	const galleryImages = isMobile && mobileImages ? mobileImages : images;
	const galleryClassName =
		layout === "threeFeature"
			? "flex w-full flex-col gap-6 lg:flex-row"
			: "w-full columns-1 gap-6 sm:columns-2 xl:columns-3";
	const figureClassName =
		layout === "threeFeature"
			? "lg:flex-1"
			: "mb-6 break-inside-avoid overflow-hidden rounded-lg bg-card shadow-xl shadow-background/40";
	const imageClassName =
		layout === "threeFeature"
			? "block h-auto w-full rounded-lg shadow-xl shadow-background/40"
			: "block h-auto w-full";
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
						<p className="text-base leading-7 text-pretty text-muted-foreground md:text-lg">
							{photosPageContent.lead}
						</p>
					</div>
					<div className={galleryClassName}>
						{galleryImages.map((image, index) => (
							<figure
								key={image.src}
								className={figureClassName}>
								<Image
									src={image.src}
									alt={image.alt}
									layout="constrained"
									width={image.width}
									height={image.height}
									loading={index < 3 ? "eager" : "lazy"}
									className={imageClassName}
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
				<div className="mx-auto mt-7 flex w-full max-w-4xl flex-wrap justify-center gap-4 md:mt-12 md:gap-6">
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
						<Link to={studioSite.routes.book}>{photosPageContent.bookCta}</Link>
					</AnimatedIconButton>
					<FreeTourDialogButton
						label={photosPageContent.tourCta}
						className="h-auto min-w-56 flex-1 basis-full border-0 px-8 py-3 text-base font-medium! shadow-md shadow-background/25 md:basis-0"
					/>
				</div>
			</motion.div>
		</section>
	);
}
