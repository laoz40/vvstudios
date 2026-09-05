import { useEffect, useId, useRef } from "react";
import { Image } from "@unpic/react";
import { Maximize2, X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";
import type { PhotoGalleryImage } from "#studio/content/photos";

export interface ImageViewerTriggerProps {
	className?: string;
	image: PhotoGalleryImage;
	imageClassName?: string;
	loading?: "eager" | "lazy";
	onSelect: (image: PhotoGalleryImage) => void;
}

export function ImageViewerTrigger({
	className,
	image,
	imageClassName,
	loading = "lazy",
	onSelect
}: ImageViewerTriggerProps) {
	return (
		<button
			type="button"
			aria-label={`View larger image of ${image.caption ?? image.alt}`}
			className={cn(
				"group relative block w-full cursor-zoom-in overflow-hidden rounded-lg text-left",
				"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
				className
			)}
			onClick={() => {
				onSelect(image);
			}}>
			<Image
				src={image.src}
				alt={image.alt}
				layout="constrained"
				width={image.width}
				height={image.height}
				loading={loading}
				className={imageClassName}
			/>
			<span className="absolute right-3 bottom-3 flex size-9 items-center justify-center rounded-full bg-background/80 text-foreground opacity-100 shadow-md backdrop-blur transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-visible:opacity-100">
				<Maximize2
					aria-hidden="true"
					className="size-5"
				/>
			</span>
		</button>
	);
}

export interface ImageViewerProps {
	image: PhotoGalleryImage | null;
	onClose: () => void;
}

export function ImageViewer({ image, onClose }: ImageViewerProps) {
	const titleId = useId();
	const dialogRef = useRef<HTMLDialogElement>(null);
	const closeButtonRef = useRef<HTMLButtonElement>(null);
	const previousFocusRef = useRef<HTMLElement | null>(null);

	// Open the native dialog and focus its close control when an image is selected.
	useEffect(() => {
		const dialog = dialogRef.current;

		if (!dialog) {
			return;
		}

		if (image && !dialog.open) {
			previousFocusRef.current =
				document.activeElement instanceof HTMLElement ? document.activeElement : null;
			dialog.showModal();
			requestAnimationFrame(() => {
				closeButtonRef.current?.focus();
			});
			return;
		}

		if (!image && dialog.open) {
			dialog.close();
		}
	}, [image]);

	// Stop the page and Lenis from scrolling behind the image viewer.
	useEffect(() => {
		if (!image) {
			return undefined;
		}

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, [image]);

	return (
		<dialog
			ref={dialogRef}
			aria-labelledby={titleId}
			className="fixed inset-0 m-0 h-dvh w-dvw max-h-none max-w-none overflow-hidden bg-black/80 p-0 text-inherit backdrop:bg-black/80"
			data-lenis-prevent
			onClose={() => {
				onClose();
				requestAnimationFrame(() => {
					previousFocusRef.current?.focus();
				});
			}}
			onMouseDown={(event) => {
				const target = event.target;
				const clickedViewerBackground =
					target instanceof HTMLElement && target.dataset.imageViewerBackground !== undefined;

				if (event.target === event.currentTarget || clickedViewerBackground) {
					event.currentTarget.close();
				}
			}}
			onWheel={(event) => {
				event.stopPropagation();
			}}>
			<div
				className="relative flex h-dvh w-dvw items-center justify-center p-0 sm:p-4"
				data-image-viewer-background>
				<h2
					id={titleId}
					className="sr-only">
					{image?.caption ?? "Image preview"}
				</h2>
				{image ? (
					<Image
						src={image.src}
						alt={image.alt}
						layout="constrained"
						width={image.width}
						height={image.height}
						className="block max-h-full max-w-full object-contain sm:max-h-9/10 sm:max-w-9/10"
					/>
				) : null}
				<Button
					ref={closeButtonRef}
					type="button"
					variant="secondary"
					size="icon"
					className="fixed top-3 right-3 z-10 rounded-full shadow-md sm:top-4 sm:right-4"
					aria-label="Close image viewer"
					onClick={() => {
						dialogRef.current?.close();
					}}>
					<X
						aria-hidden="true"
						className="size-5"
					/>
				</Button>
			</div>
		</dialog>
	);
}
