import { Button } from "#/components/ui/button";

const sectionCopy = {
	description: "You can reuse your last saved booking information.",
	action: "Reuse Last Booking Info",
} as const;

export interface BookingSavedInfoBannerProps {
	onReuse: () => void;
}

export function BookingSavedInfoBanner({ onReuse }: BookingSavedInfoBannerProps) {
	return (
		<section className="flex flex-col gap-4 rounded-2xl border border-primary/80 bg-card/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
			<p className="text-sm text-muted-foreground sm:text-base">{sectionCopy.description}</p>
			<Button
				type="button"
				size="lg"
				className="w-full rounded-2xl px-6 font-semibold sm:w-auto"
				onClick={onReuse}>
				{sectionCopy.action}
			</Button>
		</section>
	);
}
