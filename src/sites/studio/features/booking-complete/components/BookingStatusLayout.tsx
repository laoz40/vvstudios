import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { toast } from "sonner";
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
import { tryCatch } from "#/lib/result";
import { cn } from "#/lib/utils";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";

type InstagramPromptTarget =
	| { kind: "booking"; stripeSessionId: string }
	| { kind: "multiBooking"; multiBookingId: Id<"multiBookingPackages"> };

const defaultDevPanel = <BookingCompleteDevScenarioPanel />;
export interface BookingStatusLayoutProps {
	bookingStatus?: BookingStatus["status"];
	canCreateRescheduleLink?: boolean;
	children: ReactNode;
	showActions?: boolean;
	instagramPromptTarget?: InstagramPromptTarget;
	stripeSessionId?: string | null;
	className?: string;
	devPanel?: ReactNode;
}

export function BookingStatusLayout({
	bookingStatus,
	canCreateRescheduleLink = false,
	children,
	showActions = true,
	instagramPromptTarget,
	stripeSessionId,
	className,
	devPanel = defaultDevPanel
}: BookingStatusLayoutProps): ReactNode {
	const [isCreatingRescheduleLink, setIsCreatingRescheduleLink] = useState(false);
	const createFailedSessionRescheduleLink = useMutation(
		api.sessionReschedule.createPublicFailedSessionRescheduleLink
	);
	const isFailedBooking = bookingStatus === "failed";
	const resolvedInstagramPromptTarget =
		instagramPromptTarget ??
		((bookingStatus === "confirmed" || bookingStatus === "email_failed") && stripeSessionId
			? { kind: "booking", stripeSessionId }
			: null);

	async function handleRescheduleClick(): Promise<void> {
		if (!stripeSessionId) {
			toast.error("Unable to create a reschedule link for this booking.");
			return;
		}

		setIsCreatingRescheduleLink(true);

		try {
			const [error, result] = await tryCatch(
				createFailedSessionRescheduleLink({ stripeSessionId })
			);

			if (error !== null) {
				switch (error.reason) {
					case "BOOKING_NOT_FOUND":
						toast.error("Unable to find this booking.");
						return;

					case "BOOKING_NOT_FAILED":
					case "BOOKING_NOT_RESCHEDULABLE":
						toast.error("This booking cannot be rescheduled from this page.");
						return;

					case "RESCHEDULE_LINK_EXPIRED":
						toast.error("This booking can no longer be rescheduled online.");
						return;

					case "UNEXPECTED_ERROR":
						toast.error("Something went wrong while creating the reschedule link.");
						return;

					default: {
						const _exhaustive: never = error;
						return _exhaustive;
					}
				}
			}

			window.location.assign(result.rescheduleUrl);
		} finally {
			setIsCreatingRescheduleLink(false);
		}
	}
	function startReschedule(): void {
		void handleRescheduleClick();
	}

	return (
		<main
			className={cn(
				"mx-auto flex min-h-screen w-full max-w-3xl flex-1 flex-col justify-center",
				"gap-6 px-4 py-8 sm:gap-8 sm:px-6 sm:py-10",
				className
			)}>
			{children}
			{import.meta.env.DEV ? devPanel : null}

			{showActions ? (
				<BookingActions
					canCreateRescheduleLink={canCreateRescheduleLink}
					isCreatingRescheduleLink={isCreatingRescheduleLink}
					isFailedBooking={isFailedBooking}
					onReschedule={startReschedule}
					stripeSessionId={stripeSessionId}
				/>
			) : null}

			{resolvedInstagramPromptTarget ? (
				<div className="mt-8 sm:mt-24">
					<InstagramRepostPrompt target={resolvedInstagramPromptTarget} />
				</div>
			) : null}
		</main>
	);
}

interface BookingActionsProps {
	canCreateRescheduleLink: boolean;
	isCreatingRescheduleLink: boolean;
	isFailedBooking: boolean;
	onReschedule: () => void;
	stripeSessionId?: string | null;
}

function BookingActions(props: BookingActionsProps): ReactNode {
	return (
		<div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
			{props.isFailedBooking ? <FailedBookingActions {...props} /> : <SuccessfulBookingActions />}
		</div>
	);
}

function FailedBookingActions({
	canCreateRescheduleLink,
	isCreatingRescheduleLink,
	onReschedule,
	stripeSessionId
}: BookingActionsProps): ReactNode {
	const canReschedule = canCreateRescheduleLink && Boolean(stripeSessionId);

	return (
		<>
			{canReschedule ? (
				<AnimatedIconButton
					size="lg"
					className={cn(
						"h-auto w-full sm:w-auto",
						"px-8 py-3",
						"text-base font-medium",
						"shadow-lg shadow-primary/45"
					)}
					disabled={isCreatingRescheduleLink}
					renderIcon={(iconRef) => (
						<ArrowNarrowRightIcon
							ref={iconRef}
							strokeWidth={3}
							className="translate-y-px"
							aria-hidden
						/>
					)}>
					<button
						type="button"
						onClick={onReschedule}>
						{isCreatingRescheduleLink ? "Creating link..." : "Reschedule booking"}
					</button>
				</AnimatedIconButton>
			) : null}
			<AnimatedIconButton
				size="lg"
				className={cn(
					"h-auto w-full sm:w-auto",
					"px-8 py-3",
					"text-base font-medium",
					canReschedule
						? "border-none shadow-md shadow-background/25"
						: "shadow-lg shadow-primary/45"
				)}
				variant={canReschedule ? "outline" : undefined}
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
		</>
	);
}

function SuccessfulBookingActions(): ReactNode {
	return (
		<>
			<AnimatedIconButton
				size="lg"
				className={cn(
					"h-auto w-full sm:w-auto",
					"px-8 py-3",
					"text-base font-medium",
					"shadow-lg shadow-primary/45"
				)}
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
			<AnimatedIconButton
				size="lg"
				className={cn(
					"h-auto w-full sm:w-auto",
					"px-8 py-3",
					"text-base font-medium",
					"border-none shadow-md shadow-background/25"
				)}
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
		</>
	);
}
