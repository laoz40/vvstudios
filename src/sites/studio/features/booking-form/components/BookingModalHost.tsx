import { Suspense, lazy } from "react";

import {
	PackageUnscheduleConfirmation,
	RescheduleConfirmation
} from "#studio/features/booking-form/components/BookingConfirmationDialogs";
import { ClipsPackageRequirementDialog } from "#studio/features/booking-form/components/ClipsPackageRequirementDialog";
import { GmailRequiredDialog } from "#studio/features/booking-form/components/GmailRequiredDialog";
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
	onPackageUnscheduleConfirm?: () => void;
	onPaymentClose: (checkoutSession: EmbeddedCheckoutSession) => void;
	onRescheduleConfirm?: () => void;
	onTermsConfirm: () => void;
}

export function BookingModalHost({
	isSubmitting,
	onPackageUnscheduleConfirm,
	onPaymentClose,
	onRescheduleConfirm,
	onTermsConfirm
}: BookingModalHostProps) {
	const bookingModalState = useBookingModalStore((state) => state);

	switch (bookingModalState.modal) {
		case "clipsPackageRequirement":
			return <ClipsPackageRequirementDialog reason={bookingModalState.reason} />;

		case "gmailRequired":
			return <GmailRequiredDialog />;

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

		case "packageUnscheduleConfirmation":
			return (
				<PackageUnscheduleConfirmation
					isSubmitting={isSubmitting}
					modalState={bookingModalState}
					onConfirm={onPackageUnscheduleConfirm}
				/>
			);

		case "rescheduleConfirmation":
			return (
				<RescheduleConfirmation
					isSubmitting={isSubmitting}
					modalState={bookingModalState}
					onConfirm={onRescheduleConfirm}
				/>
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
