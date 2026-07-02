import { LoaderCircle } from "lucide-react";

import { Button } from "#/components/ui/button";
import { Modal } from "#studio/components/Modal";
import {
	closeBookingModal,
	type BookingModalState
} from "#studio/features/booking-form/lib/booking-modal-store";

type SessionSummaryState = Extract<BookingModalState, { modal: "sessionSummary" }>;
type PackageSlotConfirmationState = Extract<
	BookingModalState,
	{ modal: "packageSlotConfirmation" }
>;
type RescheduleConfirmationState = Extract<BookingModalState, { modal: "rescheduleConfirmation" }>;

interface SessionSummaryProps {
	modalState: SessionSummaryState;
}

interface PackageSlotConfirmationProps {
	isSubmitting: boolean;
	modalState: PackageSlotConfirmationState;
	onConfirm?: () => void;
}

interface RescheduleConfirmationProps {
	isSubmitting: boolean;
	modalState: RescheduleConfirmationState;
	onConfirm?: () => void;
}

export function SessionSummary({ modalState }: SessionSummaryProps) {
	return (
		<Modal
			open
			onOpenChange={closeBookingModal}
			title={
				<span className="block text-center text-lg font-medium text-muted-foreground">
					Selected Session
				</span>
			}
			closeLabel="Close dialog"
			className="gap-4 px-6 py-4 sm:px-8"
			footer={
				<Button
					type="button"
					className="mt-4 w-full"
					onClick={closeBookingModal}>
					Confirm
				</Button>
			}>
			<div className="space-y-2 text-center">
				<p className="text-foreground text-3xl font-semibold tracking-tight">
					{modalState.dateSummary}
				</p>
				<p className="text-xl font-medium">{modalState.timeSummary}</p>
			</div>
		</Modal>
	);
}

export function PackageSlotConfirmation({
	isSubmitting,
	modalState,
	onConfirm
}: PackageSlotConfirmationProps) {
	const isConfirmingSession = modalState.type === "save";
	const confirmLabel = isConfirmingSession ? "Confirm Session" : "Unschedule";
	const submittingLabel = isConfirmingSession ? "Confirming..." : "Unscheduling...";

	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open && !isSubmitting) {
					closeBookingModal();
				}
			}}
			title={
				<span className="block text-center text-lg font-medium text-muted-foreground">
					{isConfirmingSession ? "Selected Session" : "Unschedule Session"}
				</span>
			}
			closeLabel="Close dialog"
			preventClose={isSubmitting}
			className="gap-4 px-6 py-4 sm:px-8"
			footer={
				<div className="mt-4 flex w-full flex-col-reverse gap-2 sm:flex-row">
					<Button
						type="button"
						variant="secondary"
						className="flex-1"
						disabled={isSubmitting}
						onClick={closeBookingModal}>
						Cancel
					</Button>
					<Button
						type="button"
						variant={isConfirmingSession ? "default" : "destructive"}
						className="flex-1"
						disabled={isSubmitting || !onConfirm}
						onClick={onConfirm}>
						{isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
						{isSubmitting ? submittingLabel : confirmLabel}
					</Button>
				</div>
			}>
			<div className="space-y-3 text-center">
				{isConfirmingSession ? (
					<>
						<p className="text-foreground text-3xl font-semibold tracking-tight">
							{modalState.dateSummary}
						</p>
						<p className="text-xl font-medium">{modalState.timeSummary}</p>
					</>
				) : (
					<div className="space-y-2 text-center">
						<p className="text-foreground text-2xl font-semibold tracking-tight">
							{modalState.dateSummary}
						</p>
						<p className="text-muted-foreground text-balance leading-6">
							This will remove this session from the calendar. You can pick a new date again later.
						</p>
					</div>
				)}
			</div>
		</Modal>
	);
}

export function RescheduleConfirmation({
	isSubmitting,
	modalState,
	onConfirm
}: RescheduleConfirmationProps) {
	return (
		<Modal
			open
			onOpenChange={(open) => {
				if (!open && !isSubmitting) {
					closeBookingModal();
				}
			}}
			title={
				<span className="block text-center text-lg font-medium text-muted-foreground">
					Selected Session
				</span>
			}
			closeLabel="Close dialog"
			preventClose={isSubmitting}
			className="gap-4 px-6 py-4 sm:px-8"
			footer={
				<div className="flex w-full flex-col-reverse gap-2 sm:flex-row">
					<Button
						type="button"
						variant="secondary"
						className="flex-1"
						disabled={isSubmitting}
						onClick={closeBookingModal}>
						Cancel
					</Button>
					<Button
						type="button"
						className="flex-1"
						disabled={isSubmitting || !onConfirm}
						onClick={onConfirm}>
						{isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
						{isSubmitting ? "Updating..." : "Update Booking"}
					</Button>
				</div>
			}>
			<div className="space-y-2 text-center">
				<p className="text-foreground text-3xl font-semibold tracking-tight">
					{modalState.dateSummary}
				</p>
				<p className="text-xl font-medium">{modalState.timeSummary}</p>
			</div>
		</Modal>
	);
}
