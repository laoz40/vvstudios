import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { ArrowRight } from "lucide-react";
import { FreeTourDialogButton } from "#studio/components/FreeTourDialog";
import { Button } from "#/components/ui/button";
import { studioSite } from "#/config/sites";
import { photosPageContent, type PhotoGalleryImage } from "#studio/content/photos";
import { cn } from "#/lib/utils";

export interface PhotosSectionProps {
	className?: string;
	headingLevel?: "h1" | "h2";
	images?: PhotoGalleryImage[];
}

const headingTagClassName =
	"font-brand text-[2.5rem] leading-none text-pretty tracking-tight uppercase md:text-6xl";

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
			<div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6">
				<div className="max-w-3xl space-y-4 text-center">{heading}</div>
				<div className="columns-1 gap-4 sm:columns-2 xl:columns-3">
					{images.map((image, index) => (
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
				<Button
					asChild
					size="lg"
					className="h-auto min-w-56 flex-1 basis-full gap-1.5 px-8 py-3 text-base font-medium shadow-lg shadow-primary/45 md:basis-0">
					<Link to={studioSite.routes.book}>
						{photosPageContent.bookCta}
						<ArrowRight
							className="translate-y-px stroke-3"
							aria-hidden
						/>
					</Link>
				</Button>
				<FreeTourDialogButton
					label={photosPageContent.tourCta}
					className="h-auto min-w-56 flex-1 basis-full border-0 px-8 py-3 text-base font-medium! shadow-md shadow-background/25 md:basis-0"
				/>
			</div>
		</section>
	);
}
