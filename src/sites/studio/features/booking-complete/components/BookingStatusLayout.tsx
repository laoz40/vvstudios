import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, Home, Phone } from "lucide-react";
import {
	type BookingStatus,
	BookingCompleteDevScenarioPanel,
} from "#studio/components/booking/BookingCompleteDevScenarioPanel";
import { InstagramRepostPrompt } from "#studio/features/booking-complete/components/InstagramRepostPrompt";
import { Button } from "#/components/ui/button";
import { studioSite } from "#/config/sites";

export interface BookingStatusLayoutProps {
	bookingStatus?: BookingStatus["status"];
	children: ReactNode;
	showActions?: boolean;
	stripeSessionId?: string | null;
}

export function BookingStatusLayout({
	bookingStatus,
	children,
	showActions = true,
	stripeSessionId,
}: BookingStatusLayoutProps): ReactNode {
	const primaryAction = bookingStatus === "failed" ? "contact" : "new_booking";
	const showInstagramPrompt = bookingStatus === "confirmed" && Boolean(stripeSessionId);

	return (
		<main className="mx-auto flex min-h-screen w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10">
			{children}
			{import.meta.env.DEV ? <BookingCompleteDevScenarioPanel /> : null}

			{showActions ? (
				<div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
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

			{showInstagramPrompt && stripeSessionId ? (
				<div className="mt-8 sm:mt-20">
					<InstagramRepostPrompt stripeSessionId={stripeSessionId} />
				</div>
			) : null}
		</main>
	);
}
