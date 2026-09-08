import type { ReactElement } from "react";
import { Link } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { BookingActionButton } from "#studio/components/booking/BookingActionButton";
import { studioSite } from "#/config/sites";
import { cn } from "#/lib/utils";

type BookAgainHomeActionsProps = {
	className?: string;
	outcome: "book-again-home";
	primaryLabel: string;
};

type FailedBookingActionsProps = {
	canCreateRescheduleLink: boolean;
	className?: string;
	isCreatingRescheduleLink: boolean;
	onReschedule: () => void;
	outcome: "failed";
	stripeSessionId?: string | null;
};

export type BookingOutcomeActionsProps = BookAgainHomeActionsProps | FailedBookingActionsProps;

export function BookingOutcomeActions(props: BookingOutcomeActionsProps): ReactElement {
	return (
		<div className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap", props.className)}>
			{props.outcome === "book-again-home" ? (
				<BookAgainHomeActions primaryLabel={props.primaryLabel} />
			) : (
				<FailedBookingActions {...props} />
			)}
		</div>
	);
}

function BookAgainHomeActions({ primaryLabel }: { primaryLabel: string }): ReactElement {
	return (
		<>
			<BookingActionButton
				emphasis="primary"
				icon="arrow">
				<Link to={studioSite.routes.book}>{primaryLabel}</Link>
			</BookingActionButton>
			<BookingActionButton
				emphasis="secondary"
				icon="home">
				<Link to={studioSite.routes.home}>Return home</Link>
			</BookingActionButton>
		</>
	);
}

function FailedBookingActions({
	canCreateRescheduleLink,
	isCreatingRescheduleLink,
	onReschedule,
	stripeSessionId
}: FailedBookingActionsProps): ReactElement {
	const canReschedule = canCreateRescheduleLink && Boolean(stripeSessionId);

	return (
		<>
			{canReschedule ? (
				<BookingActionButton
					emphasis="primary"
					icon="arrow"
					disabled={isCreatingRescheduleLink}>
					<button
						type="button"
						onClick={onReschedule}>
						{isCreatingRescheduleLink ? (
							<LoaderCircle
								data-icon="inline-start"
								className="animate-spin"
							/>
						) : null}
						{isCreatingRescheduleLink ? "Creating link" : "Reschedule booking"}
					</button>
				</BookingActionButton>
			) : null}
			<BookingActionButton
				emphasis={canReschedule ? "secondary" : "primary"}
				icon="phone">
				<a
					href={studioSite.routes.contact}
					rel="noreferrer"
					target="_blank">
					Contact us
				</a>
			</BookingActionButton>
		</>
	);
}
