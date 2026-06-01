import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "#/components/ui/button";
import { studioSite } from "#/config/sites";
import { FreeTourDialogButton } from "#studio/components/FreeTourDialog";

const contactActionCopy = {
	bookCta: "Book session",
	tourCta: "Take free tour",
} as const;

export function ContactActions() {
	return (
		<div className="mx-auto mt-7 flex w-full max-w-4xl flex-wrap justify-center gap-4 md:mt-12 md:gap-6">
			<Button
				asChild
				size="lg"
				className="h-auto min-w-56 flex-1 basis-full gap-1.5 px-8 py-3 text-base font-medium shadow-lg shadow-primary/45 md:basis-0">
				<Link to={studioSite.routes.book}>
					{contactActionCopy.bookCta}
					<ArrowRight
						className="translate-y-px stroke-3"
						aria-hidden
					/>
				</Link>
			</Button>
			<FreeTourDialogButton
				label={contactActionCopy.tourCta}
				className="h-auto min-w-56 flex-1 basis-full border-0 px-8 py-3 text-base font-medium! shadow-md shadow-background/25 md:basis-0"
			/>
		</div>
	);
}
