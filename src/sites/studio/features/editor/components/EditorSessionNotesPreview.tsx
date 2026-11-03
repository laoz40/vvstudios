import { useEffect, useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger
} from "#/components/ui/dialog";

type EditorSessionNotesPreviewProps = {
	bookingName: string;
	label: string;
	notes: string | undefined;
};

export function EditorSessionNotesPreview({
	bookingName,
	label,
	notes
}: EditorSessionNotesPreviewProps) {
	const text = notes?.trim();
	const previewRef = useRef<HTMLParagraphElement>(null);
	const [isTruncated, setIsTruncated] = useState(false);

	useEffect(() => {
		const preview = previewRef.current;

		if (!preview) return undefined;

		const measureOverflow = () => {
			setIsTruncated(
				preview.scrollHeight > preview.clientHeight || preview.scrollWidth > preview.clientWidth
			);
		};

		measureOverflow();
		const observer = new ResizeObserver(measureOverflow);
		observer.observe(preview);

		return () => observer.disconnect();
	}, [text]);

	if (!text) {
		return <span className="text-sm text-muted-foreground">-</span>;
	}

	return (
		<div className="relative flex min-w-0 flex-1 items-baseline gap-1 text-sm text-muted-foreground">
			{/* Measure the full column width so the button cannot affect whether it is needed. */}
			<p
				ref={previewRef}
				aria-hidden
				className="pointer-events-none invisible absolute inset-x-0 top-0 line-clamp-1 [overflow-wrap:anywhere] whitespace-pre-wrap">
				{text}
			</p>
			<p className="min-w-0 truncate">{text}</p>
			{isTruncated ? (
				<Dialog>
					<DialogTrigger asChild>
						<button
							type="button"
							aria-label={`View ${label.toLowerCase()} for ${bookingName}`}
							className="shrink-0 cursor-pointer rounded-sm text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
							View more
						</button>
					</DialogTrigger>
					<DialogContent className="max-h-[calc(100dvh-2rem)] grid-rows-[auto_minmax(0,1fr)_auto] sm:max-w-3xl">
						<DialogHeader>
							<DialogTitle>{label}</DialogTitle>
							<DialogDescription>Notes for {bookingName}&apos;s session.</DialogDescription>
						</DialogHeader>
						<div className="min-h-0 min-w-0 overflow-y-auto text-sm leading-relaxed [overflow-wrap:anywhere] whitespace-pre-wrap select-text">
							{text}
						</div>
						<DialogFooter>
							<DialogClose asChild>
								<Button
									type="button"
									variant="outline">
									Close
								</Button>
							</DialogClose>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			) : null}
		</div>
	);
}
