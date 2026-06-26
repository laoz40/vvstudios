import { Link } from "@tanstack/react-router";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import { studioSite } from "#/config/sites";
import { cn } from "#/lib/utils";
import { FreeTourModalButton } from "#studio/components/FreeTourModal";

const contactActionCopy = { bookCta: "Book session", tourCta: "Take free tour" } as const;

type ContactActionsProps = { className?: string };

export function ContactActions({ className }: ContactActionsProps) {
	return (
		<div
			className={cn(
				"mx-auto mt-7 flex w-full max-w-4xl flex-wrap justify-center",
				"gap-4 md:mt-12 md:gap-6",
				className
			)}>
			<AnimatedIconButton
				className={cn(
					"h-auto min-w-56 flex-1 basis-full justify-center md:basis-0",
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
					"h-auto min-w-56 flex-1 basis-full md:basis-0",
					"px-8 py-3",
					"text-base font-medium!",
					"border-0 shadow-md shadow-background/25"
				)}
			/>
		</div>
	);
}
