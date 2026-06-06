import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import { studioSite } from "#/config/sites";
import { Image } from "@unpic/react";
import { motion } from "motion/react";
import { FreeTourDialogButton } from "#studio/components/FreeTourDialog";
import { photosPageContent, type PhotoGalleryImage } from "#studio/content/photos";
import { useFadeInAnimation } from "#studio/lib/useFadeInAnimation";
import { cn } from "#/lib/utils";

export interface PhotosSectionProps {
	className?: string;
	headingLevel?: "h1" | "h2";
	images?: PhotoGalleryImage[];
	mobileImages?: PhotoGalleryImage[];
	fadeIn?: boolean;
}

const headingTagClassName =
	"font-brand text-[2.5rem] leading-none text-balance tracking-tight uppercase md:text-6xl";

export function PhotosSection({
	className,
	headingLevel = "h2",
	images = photosPageContent.galleryImages,
	mobileImages,
	fadeIn = false,
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
	const heading =
		headingLevel === "h1" ? (
			<h1 className={headingTagClassName}>{photosPageContent.title}</h1>
		) : (
			<h2 className={headingTagClassName}>{photosPageContent.title}</h2>
		);

	return (
		<section className={cn("px-4 pb-16", className)}>
			<motion.div {...fadeInAnimation}>
				<div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-8 md:gap-10">
					<div className="max-w-4xl space-y-4 text-left md:text-center">
						{heading}
						<p className="text-base leading-7 text-pretty text-muted-foreground md:text-lg">
							{photosPageContent.lead}
						</p>
					</div>
					<div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
						{galleryImages.map((image, index) => (
							<figure
								key={image.src}
								className="mb-4 break-inside-avoid overflow-hidden rounded-lg border border-border bg-card shadow-lg shadow-background/25">
								<Image
									src={image.src}
									alt={image.alt}
									layout="constrained"
									width={image.width}
									height={image.height}
									loading={index < 3 ? "eager" : "lazy"}
									className="block h-auto w-full"
								/>
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
