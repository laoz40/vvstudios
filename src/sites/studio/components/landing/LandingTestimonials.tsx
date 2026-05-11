import { Link } from "@tanstack/react-router";
import { ArrowRight, Star } from "lucide-react";
import { FreeTourDialogButton } from "#studio/components/FreeTourDialog";
import { Button } from "#/components/ui/button";
import { studioSite } from "#/config/sites";
import { Card, CardContent, CardFooter } from "#/components/ui/card";

const testimonialCopy = {
	title: "Trusted by creators in Sydney",
	lead: "VV Studios is a multimedia space in South West Sydney specialising in top-quality audio-visual production. We offer 4K video and industry-standard audio equipment to ensure your content shines.",
	bookCta: "Book session",
	tourCta: "Take free tour",
	reviews: [
		{
			quote:
				"Really good facility. Professional setup with owner at the helm managing the recording and sound. Highly recommended!",
			author: "Jeremy Yang",
		},
		{
			quote:
				"I plan on coming back to shoot even more content! The studio is clean and well put together, very professional. Joseph uses high quality gear to capture the footage and audio, and can also do the editing for you.",
			author: "Omar M",
		},
	],
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
	return (
		<section
			aria-labelledby="landing-testimonials-title"
			className="px-4 py-16 md:py-20">
			<div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-10 text-center">
				<div className="flex max-w-4xl flex-col items-center gap-5">
					<h2
						id="landing-testimonials-title"
						className="font-brand text-[2.5rem] leading-none text-pretty tracking-tight uppercase md:text-6xl">
						{testimonialCopy.title}
					</h2>
					<p className="text-base leading-7 text-pretty text-muted-foreground md:text-lg">
						{testimonialCopy.lead}
					</p>
				</div>

				<div className="grid w-full gap-4 text-left md:grid-cols-2 md:gap-6">
					{testimonialCopy.reviews.map((review) => (
						<Card
							key={review.author}
							className="h-full gap-4 rounded-lg border-border/80 bg-card/80 py-6 shadow-lg shadow-background/20">
							<CardContent className="px-6">
								<blockquote className="text-base leading-8 text-pretty italic md:text-2xl md:leading-9">
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

				<div className="mt-7 flex w-full max-w-4xl flex-wrap justify-center gap-4 md:mt-12 md:gap-6">
					<Button
						asChild
						size="lg"
						className="h-auto min-w-56 flex-1 basis-full gap-1.5 px-8 py-3 text-base font-medium shadow-lg shadow-primary/45 md:basis-0">
						<Link to={studioSite.routes.book}>
							{testimonialCopy.bookCta}
							<ArrowRight
								className="translate-y-px stroke-3"
								aria-hidden
							/>
						</Link>
					</Button>
					<FreeTourDialogButton
						label={testimonialCopy.tourCta}
						className="h-auto min-w-56 flex-1 basis-full border-0 px-8 py-3 text-base font-medium! shadow-md shadow-background/25 md:basis-0"
					/>
				</div>
			</div>
		</section>
	);
}
