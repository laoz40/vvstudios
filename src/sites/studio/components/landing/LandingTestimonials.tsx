import { useState } from "react";
import { Star } from "lucide-react";
import { motion } from "motion/react";
import { Card, CardContent, CardFooter } from "#/components/ui/card";
import { cn } from "#/lib/utils";
import girlSingingImage from "#studio/assets/gallery/girl-singing.webp";
import { ContactActions } from "#studio/components/contact/ContactActions";
import { ImageViewer, ImageViewerTrigger } from "#studio/components/photos/ImageViewer";
import type { PhotoGalleryImage } from "#studio/content/photos";
import {
	landingContactActionsStackedClassName,
	landingSectionContentGapClassName,
	landingSectionHeadingClassName,
	landingSectionIntroGapClassName
} from "#studio/lib/landing-styles";
import { useFadeInAnimation } from "#studio/hooks/useFadeInAnimation";

const testimonialCopy = {
	title: "Trusted by creators in Sydney",
	reviews: [
		{
			quote:
				"I am so thankful I found VV Studios and Joseph. He made me feel so supported and relaxed about recording and answered all my questions. I would recommend him to anyone looking for similar services.",
			author: "Breanna Sada"
		},
		{
			quote:
				"Really good facility. Professional setup with owner at the helm managing the recording and sound. Highly recommended!",
			author: "Jeremy Yang"
		},
		{
			quote:
				"I plan on coming back to shoot even more content. Joseph uses high quality gear to capture the footage and audio, and can also do the editing for you.",
			author: "Omar M"
		}
	]
} as const;

const testimonialImage: PhotoGalleryImage = {
	src: girlSingingImage,
	alt: "Creator singing into a microphone at VV Studios Sydney",
	width: 1788,
	height: 1117
};

function StarRating() {
	return (
		<div
			className="flex shrink-0 gap-1 text-primary"
			aria-label="Five stars">
			{[1, 2, 3, 4, 5].map((star) => (
				<Star
					key={star}
					className="size-4 fill-current stroke-0"
					aria-hidden
				/>
			))}
		</div>
	);
}

export function LandingTestimonials() {
	const [previewImage, setPreviewImage] = useState<PhotoGalleryImage | null>(null);
	const fadeInAnimation = useFadeInAnimation(true);

	return (
		<section
			aria-labelledby="landing-testimonials-title"
			className="px-4 pt-20 pb-16 md:px-12 md:pt-40 md:pb-20 lg:px-24 xl:px-32 2xl:px-48">
			<motion.div
				className={cn(
					"flex flex-col items-start md:items-center",
					landingSectionIntroGapClassName,
					"w-full",
					"text-left md:text-center"
				)}
				{...fadeInAnimation}>
				<h2
					id="landing-testimonials-title"
					className={landingSectionHeadingClassName}>
					{testimonialCopy.title}
				</h2>

				<div
					className={cn(
						"grid md:grid-cols-2 md:items-stretch",
						landingSectionContentGapClassName,
						"w-full",
						"md:text-left"
					)}>
					<ImageViewerTrigger
						image={testimonialImage}
						onSelect={setPreviewImage}
						className={cn(
							"relative",
							"overflow-hidden md:hidden",
							"h-80 w-full",
							"rounded-lg bg-card",
							"shadow-xl shadow-background/40"
						)}
						imageClassName="absolute inset-0 size-full object-cover"
					/>

					<div
						className={cn(
							"flex flex-col items-center gap-10 md:order-2 md:items-start",
							"w-full md:h-full"
						)}>
						<div className="grid w-full gap-4 text-left md:gap-6">
							{testimonialCopy.reviews.map((review) => (
								<Card
									key={review.author}
									className={cn(
										"gap-4",
										"h-full",
										"py-6",
										"rounded-lg border-border/80 bg-card/80",
										"shadow-lg shadow-background/20"
									)}>
									<CardContent className="px-6">
										<blockquote className="text-base leading-7 text-pretty italic md:text-xl md:leading-9">
											“{review.quote}”
										</blockquote>
									</CardContent>
									<CardFooter
										className={cn(
											"flex items-center gap-3",
											"px-6",
											"text-base font-medium text-muted-foreground"
										)}>
										<span>- {review.author}</span>
										<StarRating />
									</CardFooter>
								</Card>
							))}
						</div>
					</div>

					<div
						className={cn("flex flex-col gap-6 md:order-1 md:justify-between", "w-full md:h-full")}>
						<ImageViewerTrigger
							image={testimonialImage}
							onSelect={setPreviewImage}
							className={cn(
								"relative",
								"hidden overflow-hidden md:block",
								"min-h-0 w-full flex-1",
								"rounded-lg bg-card",
								"shadow-xl shadow-background/40"
							)}
							imageClassName="absolute inset-0 size-full object-cover"
						/>

						<ContactActions
							className={cn(landingContactActionsStackedClassName, "md:justify-start")}
						/>
					</div>
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
