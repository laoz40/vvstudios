import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Image } from "@unpic/react";
import { X } from "lucide-react";
import { Dialog } from "radix-ui";
import { Button } from "#/components/ui/button";
import { photosPageContent, type PhotoGalleryImage } from "#/content/photos";
import { env } from "#/env";
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
				<FreeTourButton className="min-w-64 flex-1 border-2 px-4 py-5 text-base font-semibold sm:px-8" />
			</div>
		</section>
	);
}

function FreeTourButton({ className }: { className?: string }) {
	const [isOpen, setIsOpen] = useState(false);

	return (
		<Dialog.Root
			open={isOpen}
			onOpenChange={setIsOpen}>
			<Dialog.Trigger asChild>
				<Button
					type="button"
					variant="outline"
					size="lg"
					className={className}>
					{photosPageContent.tourCta}
				</Button>
			</Dialog.Trigger>
			<Dialog.Portal>
				<Dialog.Overlay className="fixed inset-0 z-50 bg-black/80" />
				<Dialog.Content
					aria-label={photosPageContent.tourDialogLabel}
					className="bg-popover fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-1.5rem)] max-w-6xl -translate-x-1/2 -translate-y-1/2 flex-col gap-3 rounded-2xl px-3 py-3 shadow-2xl outline-none sm:w-[calc(100%-2rem)] sm:px-4 sm:py-4">
					<div className="flex items-center justify-between gap-3">
						<Dialog.Title className="text-lg font-semibold text-foreground">
							{photosPageContent.tourDialogLabel}
						</Dialog.Title>
						<Dialog.Close asChild>
							<Button
								type="button"
								variant="ghost"
								size="icon-sm"
								aria-label={photosPageContent.tourDialogCloseLabel}>
								<X />
							</Button>
						</Dialog.Close>
					</div>
					<div className="overflow-hidden rounded-xl bg-white p-1">
						<iframe
							src={env.VITE_FREE_TOUR_URL}
							title={photosPageContent.tourIframeTitle}
							className="block min-h-176 w-full border-0 bg-transparent"
						/>
					</div>
				</Dialog.Content>
			</Dialog.Portal>
		</Dialog.Root>
	);
}
