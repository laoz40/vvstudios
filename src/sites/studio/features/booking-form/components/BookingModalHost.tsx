import { Suspense, lazy } from "react";

import { Button } from "#/components/ui/button";
import { Modal } from "#studio/components/Modal";
import { TermsDialog } from "#studio/features/booking-form/components/TermsDialog";
import type { EmbeddedCheckoutSession } from "#studio/features/booking-form/lib/checkout-session";
import {
	closeBookingModal,
	useBookingModalStore
} from "#studio/features/booking-form/lib/booking-modal-store";

export const loadBookingPaymentModal = () =>
	import("#studio/features/booking-form/components/PaymentModal").then((module) => ({
		default: module.BookingPaymentModal
	}));
const BookingPaymentModal = lazy(loadBookingPaymentModal);

interface BookingModalHostProps {
	isSubmitting: boolean;
	onPackageSlotConfirm?: () => void;
	onPaymentClose: (checkoutSession: EmbeddedCheckoutSession) => void;
	onRescheduleConfirm?: () => void;
	onTermsConfirm: () => void;
}

export function BookingModalHost({
	isSubmitting,
	onPackageSlotConfirm,
	onPaymentClose,
	onRescheduleConfirm,
	onTermsConfirm
}: BookingModalHostProps) {
	const bookingModalState = useBookingModalStore((state) => state);

	switch (bookingModalState.modal) {
		case "addonCompatibility":
			return (
				<Modal
					open
					onOpenChange={closeBookingModal}
					title="4K isn't available for remote podcasts"
					description="Remote Podcast runs through Riverside.fm using our studio setup, which doesn't support our 4K recording addon."
					closeLabel="Close"
					footer={
						<Button
							type="button"
							className="w-full"
							onClick={closeBookingModal}>
							Got it
						</Button>
					}
				/>
			);

		case "payment":
			return (
				<Suspense fallback={null}>
					<BookingPaymentModal
						clientSecret={bookingModalState.checkoutSession.clientSecret}
						onClose={() => {
							const activeCheckoutSession = bookingModalState.checkoutSession;
							closeBookingModal();
							onPaymentClose(activeCheckoutSession);
						}}
					/>
				</Suspense>
			);

		case "sessionSummary":
			return (
				<Modal
					open
					onOpenChange={closeBookingModal}
					title={
						<span className="text-muted-foreground block text-center text-lg font-medium">
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
							{bookingModalState.dateSummary}
						</p>
						<p className="text-xl font-medium">{bookingModalState.timeSummary}</p>
					</div>
				</Modal>
			);

		case "packageSlotConfirmation": {
			const isConfirmingSession = bookingModalState.type === "save";
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
								disabled={isSubmitting || !onPackageSlotConfirm}
								onClick={onPackageSlotConfirm}>
								{isSubmitting ? submittingLabel : confirmLabel}
							</Button>
						</div>
					}>
					<div className="space-y-3 text-center">
						{isConfirmingSession ? (
							<>
								<p className="text-foreground text-3xl font-semibold tracking-tight">
									{bookingModalState.dateSummary}
								</p>
								<p className="text-xl font-medium">{bookingModalState.timeSummary}</p>
							</>
						) : (
							<div className="space-y-2 text-center">
								<p className="text-foreground text-2xl font-semibold tracking-tight">
									{bookingModalState.dateSummary}
								</p>
								<p className="text-muted-foreground text-balance leading-6">
									This will remove this session from the calendar. You can pick a new date again
									later.
								</p>
							</div>
						)}
					</div>
				</Modal>
			);
		}

		case "rescheduleConfirmation":
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
								disabled={isSubmitting || !onRescheduleConfirm}
								onClick={onRescheduleConfirm}>
								{isSubmitting ? "Updating..." : "Update Booking"}
							</Button>
						</div>
					}>
					<div className="space-y-2 text-center">
						<p className="text-foreground text-3xl font-semibold tracking-tight">
							{bookingModalState.dateSummary}
						</p>
						<p className="text-xl font-medium">{bookingModalState.timeSummary}</p>
					</div>
				</Modal>
			);

		case "terms":
			return (
				<TermsDialog
					open
					isSubmitting={isSubmitting}
					onConfirm={onTermsConfirm}
					onOpenChange={(open) => {
						if (!open) {
							closeBookingModal();
						}
					}}
				/>
			);

		case "none":
			return null;

		default: {
			const _exhaustive: never = bookingModalState;
			return _exhaustive;
		}
	}
}
