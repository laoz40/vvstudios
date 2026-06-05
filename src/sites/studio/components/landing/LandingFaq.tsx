import { FreeTourDialogButton } from "#studio/components/FreeTourDialog";
import { Link } from "@tanstack/react-router";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import { studioSite } from "#/config/sites";
import { FaqSection } from "#studio/components/faq/FaqSection";

const contactActionCopy = {
	bookCta: "Book session",
	tourCta: "Take free tour",
} as const;

export function LandingFaq() {
	return (
		<div className="bg-background px-4 md:px-0 py-16 md:py-20">
			<FaqSection
				id="faq-title"
				containerClassName="mx-auto max-w-6xl"
				fadeIn
			/>
			<div className="mx-auto mt-4 flex w-full max-w-4xl flex-wrap justify-center gap-4 md:mt-6 md:gap-6">
				<AnimatedIconButton
					className="h-auto min-w-56 flex-1 basis-full gap-1.5 px-8 py-3 text-base font-medium shadow-lg shadow-primary/45 md:basis-0"
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
				<FreeTourDialogButton
					label={contactActionCopy.tourCta}
					className="h-auto min-w-56 flex-1 basis-full border-0 px-8 py-3 text-base font-medium! shadow-md shadow-background/25 md:basis-0"
				/>
			</div>
		</div>
	);
}
