import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { AnimatedIconButton } from "#/components/AnimatedIconButton";
import ArrowNarrowRightIcon from "#/components/ui/arrow-narrow-right-icon";
import HomeIcon from "#/components/ui/home-icon";
import PhoneVolume from "#/components/ui/phone-volume";
import {
	type BookingStatus,
	BookingCompleteDevScenarioPanel
} from "#studio/components/booking/BookingCompleteDevScenarioPanel";
import { InstagramRepostPrompt } from "#studio/features/booking-complete/components/InstagramRepostPrompt";
import { studioSite } from "#/config/sites";
import { cn } from "#/lib/utils";

export interface BookingStatusLayoutProps {
	bookingStatus?: BookingStatus["status"];
	children: ReactNode;
	showActions?: boolean;
	stripeSessionId?: string | null;
	className?: string;
	devPanel?: ReactNode;
}

export function BookingStatusLayout({
	bookingStatus,
	children,
	showActions = true,
	stripeSessionId,
	className,
	devPanel = <BookingCompleteDevScenarioPanel />
}: BookingStatusLayoutProps): ReactNode {
	const primaryAction = bookingStatus === "failed" ? "contact" : "new_booking";
	const showInstagramPrompt =
		(bookingStatus === "confirmed" || bookingStatus === "email_failed") && Boolean(stripeSessionId);

	return (
		<main
			className={cn(
				"mx-auto flex min-h-screen w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10",
				className
			)}>
			{children}
			{import.meta.env.DEV ? devPanel : null}

			{showActions ? (
				<div className="mt-2 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
					{primaryAction === "contact" ? (
						<AnimatedIconButton
							size="lg"
							className="h-auto w-full px-8 py-3 text-base font-medium shadow-lg shadow-primary/45 sm:w-auto"
							iconPosition="before"
							renderIcon={(iconRef) => (
								<PhoneVolume
									ref={iconRef}
									aria-hidden
									strokeWidth={3}
								/>
							)}>
							<a
								href={studioSite.routes.contact}
								rel="noreferrer"
								target="_blank">
								Contact us
							</a>
						</AnimatedIconButton>
					) : (
						<AnimatedIconButton
							size="lg"
							className="h-auto w-full px-8 py-3 text-base font-medium shadow-lg shadow-primary/45 sm:w-auto"
							renderIcon={(iconRef) => (
								<ArrowNarrowRightIcon
									ref={iconRef}
									strokeWidth={3}
									className="translate-y-px"
									aria-hidden
								/>
							)}>
							<Link to={studioSite.routes.book}>Make a new booking</Link>
						</AnimatedIconButton>
					)}
					<AnimatedIconButton
						size="lg"
						className="border-none h-auto w-full px-8 py-3 text-base font-medium shadow-md shadow-background/25 sm:w-auto"
						variant="outline"
						iconPosition="before"
						renderIcon={(iconRef) => (
							<HomeIcon
								ref={iconRef}
								aria-hidden
							/>
						)}>
						<Link to={studioSite.routes.home}>Return home</Link>
					</AnimatedIconButton>
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
