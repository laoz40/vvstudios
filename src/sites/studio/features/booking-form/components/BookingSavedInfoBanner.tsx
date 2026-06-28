import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "#/components/ui/button";
import { cn } from "#/lib/utils";

const sectionCopy = {
	description: "You can reuse your last saved booking information.",
	reuseAction: "Reuse Last Booking Info",
	removeAction: "Delete data?"
} as const;

export interface BookingSavedInfoBannerProps {
	onRemove: () => void;
	onReuse: () => void;
}

export function BookingSavedInfoBanner({ onRemove, onReuse }: BookingSavedInfoBannerProps) {
	const [isDismissed, setIsDismissed] = useState(false);

	if (isDismissed) {
		return null;
	}

	return (
		<section
			className={cn(
				"relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between",
				"rounded-lg border border-primary/80 bg-card",
				"px-4 py-4 sm:px-6",
				"shadow-lg shadow-primary/20"
			)}>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				className="absolute -top-3 -right-3 z-10 rounded-full bg-background/80 shadow-sm ring-1 ring-border backdrop-blur"
				aria-label="Hide saved booking info"
				onClick={() => setIsDismissed(true)}>
				<X className="size-4" />
			</Button>
			<p className="text-sm text-foreground">
				{sectionCopy.description}{" "}
				<Button
					type="button"
					variant="link"
					className={cn(
						"accent-link",
						"inline h-auto p-0 align-baseline",
						"text-sm text-muted-foreground underline-offset-4"
					)}
					onClick={onRemove}>
					{sectionCopy.removeAction}
				</Button>
			</p>
			<Button
				type="button"
				size="default"
				className={cn(
					"w-full sm:w-auto",
					"px-6",
					"text-sm! font-semibold",
					"shadow-lg shadow-primary/45"
				)}
				onClick={onReuse}>
				{sectionCopy.reuseAction}
			</Button>
		</section>
	);
}
