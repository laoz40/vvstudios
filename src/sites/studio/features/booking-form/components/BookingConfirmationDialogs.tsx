import { LoaderCircle } from "lucide-react";

import { Button } from "#/components/ui/button";
import { Modal } from "#studio/components/Modal";
import {
	closeBookingModal,
	type BookingModalState
} from "#studio/features/booking-form/lib/booking-modal-store";

type PackageUnscheduleConfirmationState = Extract<
	BookingModalState,
	{ modal: "packageUnscheduleConfirmation" }
>;
type RescheduleConfirmationState = Extract<BookingModalState, { modal: "rescheduleConfirmation" }>;

interface PackageUnscheduleConfirmationProps {
	isSubmitting: boolean;
	modalState: PackageUnscheduleConfirmationState;
	onConfirm?: () => void;
}

interface RescheduleConfirmationProps {
	isSubmitting: boolean;
	modalState: RescheduleConfirmationState;
	onConfirm?: () => void;
}

export function PackageUnscheduleConfirmation({
	isSubmitting,
	modalState,
	onConfirm
}: PackageUnscheduleConfirmationProps) {
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
					Unschedule {modalState.dateSummary}?
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
						variant="destructive"
						className="flex-1"
						disabled={isSubmitting || !onConfirm}
						onClick={onConfirm}>
						{isSubmitting ? <LoaderCircle className="size-4 animate-spin" /> : null}
						{isSubmitting ? "Unscheduling..." : "Unschedule"}
					</Button>
				</div>
			}>
			<div className="space-y-3 text-center">
				<p className="text-muted-foreground text-balance leading-6">
					This will remove this session from the calendar. You can pick a new date again later.
				</p>
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
