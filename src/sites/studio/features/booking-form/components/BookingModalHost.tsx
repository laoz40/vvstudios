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
	onPaymentClose: (checkoutSession: EmbeddedCheckoutSession) => void;
	onTermsConfirm: () => void;
}

export function BookingModalHost({
	isSubmitting,
	onPaymentClose,
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
