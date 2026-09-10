import { useRef, useState } from "react";
import { Image } from "@unpic/react";
import { motion, useReducedMotion, useScroll, useTransform } from "motion/react";
import { cn } from "#/lib/utils";
import { ContactActions } from "#studio/components/contact/ContactActions";
import { ImageViewer, ImageViewerOpenButton } from "#studio/components/photos/ImageViewer";
import {
	landingSetupImages,
	photosPageContent,
	type PhotoGalleryImage
} from "#studio/content/photos";
import { useFadeInAnimation } from "#studio/hooks/useFadeInAnimation";
import { useIsDesktopViewport } from "#studio/hooks/useIsDesktopViewport";
import {
	landingContactActionsClassName,
	landingSectionHeadingClassName,
	landingSectionLeadClassName,
	marketingPageHorizontalPaddingClassName
} from "#studio/lib/landing-styles";

const setupParallaxTravelPx = 100;

const setupPanelTitleClassName = cn(
	"font-brand text-2xl leading-none tracking-tight uppercase text-balance",
	"md:text-8xl"
);

function SetupShowcasePanel({
	fadeInAnimation,
	image,
	loading,
	onPreview
}: {
	fadeInAnimation: ReturnType<typeof useFadeInAnimation>;
	image: PhotoGalleryImage;
	loading: "eager" | "lazy";
	onPreview: (image: PhotoGalleryImage) => void;
}) {
	const panelRef = useRef<HTMLElement>(null);
	const prefersReducedMotion = useReducedMotion();
	const isDesktopViewport = useIsDesktopViewport();
	const { scrollYProgress } = useScroll({ target: panelRef, offset: ["start end", "end start"] });
	const imageY = useTransform(
		scrollYProgress,
		[0, 1],
		[-setupParallaxTravelPx, setupParallaxTravelPx]
	);
	const shouldParallax = isDesktopViewport && prefersReducedMotion === false;

	return (
		<motion.figure
			ref={panelRef}
			{...fadeInAnimation}
			className={cn(
				marketingPageHorizontalPaddingClassName,
				"group relative w-full md:px-0 md:h-dvh"
			)}>
			<div
				className={cn(
					"relative w-full overflow-hidden rounded-2xl",
					"md:rounded-none md:absolute md:inset-0"
				)}>
				<motion.div
					className={cn("md:absolute md:inset-x-0", shouldParallax ? undefined : "md:inset-y-0")}
					style={
						shouldParallax
							? { y: imageY, top: -setupParallaxTravelPx, bottom: -setupParallaxTravelPx }
							: undefined
					}>
					<Image
						src={image.src}
						alt={image.alt}
						layout="constrained"
						width={image.width}
						height={image.height}
						loading={loading}
						className="block w-full md:h-full md:object-cover"
					/>
				</motion.div>
				<div
					aria-hidden
					className="absolute inset-0 bg-linear-to-t from-background/90 via-background/25 to-background/10"
				/>
				<div
					className={cn(
						"absolute inset-x-4 bottom-2 text-left",
						"md:inset-x-0 md:bottom-28",
						"md:px-6 lg:px-12 xl:px-16 2xl:px-24"
					)}>
					<div className="flex flex-col items-start gap-4">
						{image.caption ? (
							<figcaption className={setupPanelTitleClassName}>{image.caption}</figcaption>
						) : null}
						<ContactActions
							layout="inline"
							className="mt-0 hidden gap-3 md:flex md:gap-4"
						/>
					</div>
				</div>
				<ImageViewerOpenButton
					className="right-2 bottom-2 md:right-6 md:bottom-6"
					image={image}
					onSelect={onPreview}
				/>
			</div>
		</motion.figure>
	);
}

export function LandingSetupsSection() {
	const [previewImage, setPreviewImage] = useState<PhotoGalleryImage | null>(null);
	const fadeInAnimation = useFadeInAnimation(true);

	return (
		<section className="pb-16">
			<motion.div
				{...fadeInAnimation}
				className={cn(
					marketingPageHorizontalPaddingClassName,
					"mx-auto flex w-full max-w-6xl flex-col gap-8 pb-8 md:gap-10 md:pb-10"
				)}>
				<div className="space-y-4 text-left md:text-center">
					<h2 className={landingSectionHeadingClassName}>{photosPageContent.title}</h2>
					<p className={cn("mx-auto max-w-5xl", landingSectionLeadClassName)}>
						{photosPageContent.lead}
					</p>
				</div>
			</motion.div>

			<div className="flex flex-col gap-6 md:gap-0">
				{landingSetupImages.map((image, index) => (
					<SetupShowcasePanel
						key={image.src}
						fadeInAnimation={fadeInAnimation}
						image={image}
						loading={index === 0 ? "eager" : "lazy"}
						onPreview={setPreviewImage}
					/>
				))}
			</div>

			<motion.div
				{...fadeInAnimation}
				className="md:hidden">
				<ContactActions
					className={cn(
						marketingPageHorizontalPaddingClassName,
						"max-w-3xl",
						landingContactActionsClassName
					)}
				/>
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
