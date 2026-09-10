import { Link } from "@tanstack/react-router";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import { studioSite } from "#/config/sites";
import { cn } from "#/lib/utils";
import { FreeTourModalButton } from "#studio/components/FreeTourModal";

const contactActionCopy = { bookCta: "Book session", tourCta: "Take free tour" } as const;

type ContactActionsProps = { className?: string; layout?: "default" | "inline" };

export function ContactActions({ className, layout = "default" }: ContactActionsProps) {
	const isInline = layout === "inline";

	return (
		<div
			className={cn(
				"mt-6 flex flex-wrap gap-4 md:gap-6",
				isInline
					? "mx-0 w-auto max-w-none justify-start"
					: "mx-auto w-full max-w-4xl justify-center",
				className
			)}>
			<AnimatedIconButton
				className={cn(
					"h-auto min-w-56 justify-center",
					isInline ? "shrink-0" : "flex-1 basis-full md:basis-0",
					"gap-1.5 px-8 py-3",
					"text-base font-medium",
					"shadow-lg shadow-primary/45"
				)}
				renderIcon={(iconRef) => (
					<ArrowNarrowRightIcon
						ref={iconRef}
						size={24}
						strokeWidth={3}
						className="translate-y-px"
					/>
				)}>
				<Link to={studioSite.routes.book}>{contactActionCopy.bookCta}</Link>
			</AnimatedIconButton>
			<FreeTourModalButton
				label={contactActionCopy.tourCta}
				className={cn(
					"h-auto min-w-56",
					isInline ? "shrink-0" : "flex-1 basis-full md:basis-0",
					"px-8 py-3",
					"text-base font-medium!",
					"border-0 shadow-md shadow-background/25"
				)}
			/>
		</div>
	);
}
