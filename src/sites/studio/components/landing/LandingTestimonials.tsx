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
	landingSectionHeadingClassName,
	landingSectionIntroGapClassName,
	marketingPageHorizontalPaddingClassName
} from "#studio/lib/landing-styles";
import { useFadeInAnimation } from "#studio/hooks/useFadeInAnimation";

const testimonialCopy = {
	title: "Trusted by creators in Sydney",
	reviews: [
		{
			quote:
				"I am so thankful I found Vertigo Visuals and Joseph. He made me feel so supported and relaxed about recording and answered all my questions. The space is beautiful and he was very professional. I would recommend him to anyone looking for similar services.",
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
		},
		{
			quote:
				"I am beyond amazed at how professional VV studios have been. Attention to detail, a bespoke approach to my particular project has ensured that I always concentrate on the guest and the space provided is sensational. I can not recommend VV and the team enough!",
			author: "NewAge Poet"
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

function TestimonialReviewCard({
	review,
	className
}: {
	review: (typeof testimonialCopy.reviews)[number];
	className?: string;
}) {
	return (
		<Card
			className={cn(
				"h-full gap-2 py-4",
				"rounded-lg border-border/80 bg-card/80",
				"shadow-lg shadow-background/20",
				className
			)}>
			<CardContent className="px-4">
				<blockquote className="text-base leading-6 text-pretty md:text-lg md:leading-7">
					“{review.quote}”
				</blockquote>
			</CardContent>
			<CardFooter
				className={cn(
					"flex items-center gap-3",
					"px-4 pt-0",
					"text-sm font-medium text-muted-foreground md:text-base"
				)}>
				<span>- {review.author}</span>
				<StarRating />
			</CardFooter>
		</Card>
	);
}

export function LandingTestimonials() {
	const [previewImage, setPreviewImage] = useState<PhotoGalleryImage | null>(null);
	const fadeInAnimation = useFadeInAnimation(true);
	const [featuredReview, ...remainingReviews] = testimonialCopy.reviews;
	const pairedReviews = remainingReviews.slice(0, 2);
	const bottomReview = remainingReviews[2];

	return (
		<section
			aria-labelledby="landing-testimonials-title"
			className={cn(marketingPageHorizontalPaddingClassName, "pt-20 pb-16 md:pt-40 md:pb-20")}>
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

				<div className={cn("flex flex-col", "w-full text-left")}>
					<div className="grid gap-4 md:grid-cols-2 md:items-stretch md:gap-6">
						<ImageViewerTrigger
							image={testimonialImage}
							onSelect={setPreviewImage}
							className={cn(
								"relative overflow-hidden",
								"h-72 w-full md:h-full",
								"rounded-lg bg-card",
								"shadow-xl shadow-background/40"
							)}
							imageClassName="h-full w-full object-cover"
						/>

						<div className="flex flex-col gap-4 md:h-full">
							<TestimonialReviewCard
								review={featuredReview}
								className="h-auto"
							/>

							<div className="grid gap-4 md:grid-cols-2 md:gap-4">
								{pairedReviews.map((review) => (
									<TestimonialReviewCard
										key={review.author}
										review={review}
									/>
								))}
							</div>

							<TestimonialReviewCard
								review={bottomReview}
								className="h-auto"
							/>

							<ContactActions className="mt-0 max-w-none justify-center md:mt-auto" />
						</div>
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
