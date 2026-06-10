import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { Star } from "lucide-react";
import { motion } from "motion/react";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import { Card, CardContent, CardFooter } from "#/components/ui/card";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import { studioSite } from "#/config/sites";
import girlSingingImage from "#studio/assets/gallery/girl-singing.webp";
import { FreeTourDialogButton } from "#studio/components/FreeTourDialog";
import { landingSectionHeadingClassName } from "#studio/lib/landing-styles";
import { useFadeInAnimation } from "#studio/lib/useFadeInAnimation";

const testimonialCopy = {
	title: "Trusted by creators in Sydney",
	bookCta: "Book session",
	tourCta: "Take free tour",
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

function StarRating() {
	return (
		<div
			className="flex shrink-0 gap-1 text-primary"
			aria-label="Five stars">
			{Array.from({ length: 5 }).map((_, index) => (
				<Star
					key={index}
					className="size-4 fill-current stroke-0"
					aria-hidden
				/>
			))}
		</div>
	);
}

export function LandingTestimonials() {
	const fadeInAnimation = useFadeInAnimation(true);

	return (
		<section
			aria-labelledby="landing-testimonials-title"
			className="px-4 pt-28 pb-16 md:px-12 md:pt-40 md:pb-20 lg:px-24 xl:px-32 2xl:px-48">
			<motion.div
				className="flex w-full flex-col items-start gap-10 text-left md:items-center md:text-center"
				{...fadeInAnimation}>
				<h2
					id="landing-testimonials-title"
					className={landingSectionHeadingClassName}>
					{testimonialCopy.title}
				</h2>

				<div className="grid w-full gap-10 md:grid-cols-2 md:items-stretch md:text-left">
					<div className="relative h-80 w-full overflow-hidden rounded-lg bg-card shadow-xl shadow-background/40 md:hidden">
						<Image
							src={girlSingingImage}
							alt="Creator singing into a microphone at VV Studios Sydney"
							layout="constrained"
							width={1788}
							height={1117}
							loading="lazy"
							className="absolute inset-0 size-full object-cover"
						/>
					</div>

					<div className="flex w-full flex-col items-center gap-10 md:order-2 md:h-full md:items-start">
						<div className="grid w-full gap-4 text-left md:gap-6">
							{testimonialCopy.reviews.map((review) => (
								<Card
									key={review.author}
									className="h-full gap-4 rounded-lg border-border/80 bg-card/80 py-6 shadow-lg shadow-background/20">
									<CardContent className="px-6">
										<blockquote className="text-base leading-7 text-pretty italic md:text-xl md:leading-9">
											“{review.quote}”
										</blockquote>
									</CardContent>
									<CardFooter className="flex items-center gap-3 px-6 text-base font-medium text-muted-foreground">
										<span>- {review.author}</span>
										<StarRating />
									</CardFooter>
								</Card>
							))}
						</div>
					</div>

					<div className="flex w-full flex-col gap-6 md:order-1 md:h-full md:justify-between">
						<div className="relative hidden min-h-0 w-full flex-1 overflow-hidden rounded-lg bg-card shadow-xl shadow-background/40 md:block">
							<Image
								src={girlSingingImage}
								alt="Creator singing into a microphone at VV Studios Sydney"
								layout="constrained"
								width={1788}
								height={1117}
								loading="lazy"
								className="absolute inset-0 size-full object-cover"
							/>
						</div>

						<div className="flex w-full flex-wrap justify-center gap-4 md:justify-start md:gap-6">
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
								<Link to={studioSite.routes.book}>{testimonialCopy.bookCta}</Link>
							</AnimatedIconButton>
							<FreeTourDialogButton
								label={testimonialCopy.tourCta}
								className="h-auto min-w-56 flex-1 basis-full border-0 px-8 py-3 text-base font-medium! shadow-md shadow-background/25 md:basis-0"
							/>
						</div>
					</div>
				</div>
			</motion.div>
		</section>
	);
}
