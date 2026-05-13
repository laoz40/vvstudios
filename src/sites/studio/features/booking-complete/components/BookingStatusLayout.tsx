import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Home, Phone } from "lucide-react";
import { BookingCompleteDevScenarioPanel } from "#studio/components/booking/BookingCompleteDevScenarioPanel";
import { Button } from "#/components/ui/button";
import { studioSite } from "#/config/sites";

export interface BookingStatusLayoutProps {
	afterActions?: ReactNode;
	children: ReactNode;
	primaryAction?: "contact" | "new_booking";
	showActions?: boolean;
}

export function BookingStatusLayout({
	afterActions,
	children,
	primaryAction = "new_booking",
	showActions = true,
}: BookingStatusLayoutProps): ReactNode {
	return (
		<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10">
			{children}
			{import.meta.env.DEV ? <BookingCompleteDevScenarioPanel /> : null}

			{showActions ? (
				<div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
					<Button
						asChild
						size="lg"
						className="h-auto w-full px-8 py-3 text-base font-medium shadow-lg shadow-primary/45 sm:w-auto">
						{primaryAction === "contact" ? (
							<a
								href={studioSite.routes.contact}
								rel="noreferrer"
								target="_blank">
								<Phone
									className="stroke-2"
									aria-hidden
								/>
								Contact us
							</a>
						) : (
							<Link to={studioSite.routes.book}>
								Make a new booking
								<ArrowRight
									className="translate-y-px stroke-3"
									aria-hidden
								/>
							</Link>
						)}
					</Button>
					<Button
						asChild
						size="lg"
						className="h-auto w-full border-0 bg-background/60 px-8 py-3 text-base font-medium shadow-md shadow-background/25 hover:bg-background/75 sm:w-auto"
						variant="outline">
						<Link to={studioSite.routes.home}>
							<Home aria-hidden />
							Return home
						</Link>
					</Button>
				</div>
			) : null}

			{afterActions ? <div className="mt-8 sm:mt-10">{afterActions}</div> : null}
		</main>
	);
}
