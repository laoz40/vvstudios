import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import behindTheScenesWideImage from "#/assets/gallery/behind-the-scenes-wide.webp";
import behindTheScenesImage from "#/assets/gallery/behind-the-scenes.webp";
import expressiveManImage from "#/assets/gallery/expressive-man.webp";
import leonardoDicaprioImage from "#/assets/gallery/leonardo-dicaprio.webp";
import manAndWomanTalkingImage from "#/assets/gallery/man-and-woman-talking.webp";
import micSetupImage from "#/assets/gallery/mic-setup.webp";
import screenImage from "#/assets/gallery/screen.webp";
import tableSetupImage from "#/assets/gallery/table-setup.webp";
import trioTalkingAtTableSetupImage from "#/assets/gallery/trio-talking-at-table-setup.webp";
import { Button } from "#/components/ui/button";

const galleryCopy = {
	title: "A quick look at the space",
	intro:
		"These photos give you a proper look at the studio before you book. You can see the sets, the lighting, and the overall feel of the space, so you know what to expect when you walk in.",
	closing:
		"Like what you see? Book a session or take a free tour. The space is set up for podcasts, interviews, and branded content, with a clean, professional look on camera.",
	bookCta: "Book session",
	tourCta: "Take free tour",
} as const;

const galleryImages = [
	{
		src: leonardoDicaprioImage,
		alt: "VV Podcast Studio gallery image of the main recording setup",
		width: 1280,
		height: 960,
	},
	{
		src: tableSetupImage,
		alt: "VV Podcast Studio gallery image of a seated recording area",
		width: 1280,
		height: 891,
	},
	{
		src: expressiveManImage,
		alt: "VV Podcast Studio gallery image of the studio lighting and desk area",
		width: 1280,
		height: 960,
	},
	{
		src: manAndWomanTalkingImage,
		alt: "VV Podcast Studio gallery image of the lounge seating area",
		width: 720,
		height: 960,
	},
	{
		src: micSetupImage,
		alt: "VV Podcast Studio gallery image of the equipment and camera setup",
		width: 853,
		height: 1280,
	},
	{
		src: behindTheScenesImage,
		alt: "VV Podcast Studio gallery image showing the studio from the entry side",
		width: 721,
		height: 1280,
	},
	{
		src: behindTheScenesWideImage,
		alt: "VV Podcast Studio gallery image showing the main set with lighting",
		width: 960,
		height: 720,
	},
	{
		src: screenImage,
		alt: "VV Podcast Studio gallery image showing the armchair setup",
		width: 1280,
		height: 721,
	},
	{
		src: trioTalkingAtTableSetupImage,
		alt: "VV Podcast Studio gallery image showing the table setup",
		width: 960,
		height: 720,
	},
] as const;

export function LandingGallery() {
	return (
		<section className="bg-background px-4 pt-16 pb-16 md:px-0 md:pt-20">
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
				<div className="max-w-3xl space-y-4">
					<h2 className="text-2xl leading-none font-bold md:text-4xl">{galleryCopy.title}</h2>
					<p className="text-muted-foreground text-sm leading-7 text-pretty sm:text-base">
						{galleryCopy.intro}
					</p>
				</div>

				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{galleryImages.map((image, index) => {
						const imageClass =
							index >= 3 && index <= 5
								? "block aspect-[3/4] w-full object-cover"
								: "block aspect-[4/3] w-full object-cover";

						return (
							<figure
								key={image.alt}
								className="overflow-hidden rounded-lg border bg-card">
								<Image
									src={image.src}
									alt={image.alt}
									layout="fullWidth"
									width={image.width}
									height={image.height}
									className={imageClass}
									loading={index < 3 ? "eager" : "lazy"}
								/>
							</figure>
						);
					})}
				</div>
			</div>

			<div className="mx-auto mt-6 max-w-6xl">
				<p className="max-w-3xl text-sm leading-7 text-pretty text-muted-foreground sm:text-base">
					{galleryCopy.closing}
				</p>
			</div>

			<div className="mx-auto mt-7 flex max-w-6xl flex-wrap gap-4 md:mt-12">
				<Button
					asChild
					size="lg"
					className="min-w-64 flex-1 border-2 border-primary px-4 py-5 text-base font-semibold sm:px-8">
					<Link to="/book">{galleryCopy.bookCta}</Link>
				</Button>

				<Button
					type="button"
					variant="outline"
					size="lg"
					className="min-w-64 flex-1 border-2 px-4 py-5 text-base font-semibold sm:px-8">
					{galleryCopy.tourCta}
				</Button>
			</div>
		</section>
	);
}
