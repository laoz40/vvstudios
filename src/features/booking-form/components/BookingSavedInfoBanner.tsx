import { Button } from "#/components/ui/button";

const sectionCopy = {
	description: "You can reuse your last saved booking information.",
	reuseAction: "Reuse Last Booking Info",
	removeAction: "Delete data?",
} as const;

export interface BookingSavedInfoBannerProps {
	onRemove: () => void;
	onReuse: () => void;
}

export function BookingSavedInfoBanner({ onRemove, onReuse }: BookingSavedInfoBannerProps) {
	return (
		<section className="flex flex-col gap-4 rounded-2xl border border-primary/80 bg-card/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
			<p className="text-sm text-foreground">
				{sectionCopy.description}{" "}
				<Button
					type="button"
					variant="link"
					className="accent-link inline h-auto p-0 align-baseline text-sm text-muted-foreground underline-offset-4"
					onClick={onRemove}>
					{sectionCopy.removeAction}
				</Button>
			</p>
			<Button
				type="button"
				size="default"
				className="w-full rounded-2xl px-6 text-sm! font-semibold sm:w-auto"
				onClick={onReuse}>
				{sectionCopy.reuseAction}
			</Button>
		</section>
	);
}
