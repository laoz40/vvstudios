import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { Button } from "#/components/ui/button";
import { FreeTourDialogButton } from "#/components/FreeTourDialog";
import { photosPageContent, type PhotoGalleryImage } from "#/content/photos";
import { cn } from "#/lib/utils";

export interface PhotosSectionProps {
	className?: string;
	headingLevel?: "h1" | "h2";
	images?: PhotoGalleryImage[];
}

const headingTagClassName = "text-2xl leading-none font-bold md:text-4xl";

export function PhotosSection({
	className,
	headingLevel = "h2",
	images = photosPageContent.galleryImages,
}: PhotosSectionProps) {
	const heading =
		headingLevel === "h1" ? (
			<h1 className={headingTagClassName}>{photosPageContent.title}</h1>
		) : (
			<h2 className={headingTagClassName}>{photosPageContent.title}</h2>
		);

	return (
		<section className={cn("px-4 pt-28 pb-16 md:pt-32", className)}>
			<div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
				<div className="max-w-3xl space-y-4">
					{heading}
					<p className="text-muted-foreground text-sm leading-7 text-pretty sm:text-base">
						{photosPageContent.introText}
					</p>
				</div>
				<div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
					{images.map((image, index) => (
						<figure
							key={image.alt}
							className="border-border bg-card mb-4 break-inside-avoid overflow-hidden rounded-lg border">
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
			<div className="mx-auto mt-7 flex max-w-6xl flex-wrap gap-4 sm:gap-3 md:mt-12">
				<Button
					asChild
					size="lg"
					className="border-primary min-w-64 flex-1 px-4 py-5 text-base font-semibold sm:px-8">
					<Link to="/book">{photosPageContent.bookCta}</Link>
				</Button>
				<FreeTourDialogButton
					label={photosPageContent.tourCta}
					className="min-w-64 flex-1 border-2 px-4 py-5 text-base font-semibold sm:px-8"
				/>
			</div>
		</section>
	);
}
