import { useState, type ReactNode } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import {
	type BookingStatus,
	BookingCompleteDevScenarioPanel
} from "#studio/components/booking/BookingCompleteDevScenarioPanel";
import { BookingOutcomeActions } from "#studio/components/booking/BookingOutcomeActions";
import { InstagramRepostPrompt } from "#studio/features/booking-complete/components/InstagramRepostPrompt";
import { exhaustiveCheck, tryCatch } from "#/lib/result";
import { cn } from "#/lib/utils";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";

type InstagramPromptTarget =
	| { kind: "booking"; stripeSessionId: string }
	| { kind: "package"; packageId: Id<"packages"> };

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
				const reason = error.reason;
				switch (reason) {
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
					default:
						return exhaustiveCheck(reason);
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
	if (props.isFailedBooking) {
		return (
			<BookingOutcomeActions
				outcome="failed"
				className="mt-4"
				canCreateRescheduleLink={props.canCreateRescheduleLink}
				isCreatingRescheduleLink={props.isCreatingRescheduleLink}
				onReschedule={props.onReschedule}
				stripeSessionId={props.stripeSessionId}
			/>
		);
	}

	return (
		<BookingOutcomeActions
			outcome="book-again-home"
			className="mt-4"
			primaryLabel="Make a new booking"
		/>
	);
}
