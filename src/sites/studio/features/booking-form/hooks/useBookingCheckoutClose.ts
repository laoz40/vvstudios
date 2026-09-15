import { useCallback } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { EmbeddedCheckoutSession } from "#studio/features/booking-form/lib/checkout-session";
import { closeCheckoutToastMessages } from "#studio/features/booking-form/lib/booking-page-errors";
import { tryCatch } from "#/lib/result";

export function useBookingCheckoutClose() {
	const closeEmbeddedCheckoutSession = useAction(api.stripe.closeEmbeddedCheckoutSession);

	const closeEmbeddedPackageCheckoutSession = useAction(
		api.packagePayment.closeEmbeddedPackageCheckoutSession
	);

	const closeOpenCheckoutSession = useCallback(
		async (activeCheckoutSession: EmbeddedCheckoutSession) => {
			if (activeCheckoutSession.kind === "package") {
				const [error] = await tryCatch(
					closeEmbeddedPackageCheckoutSession({
						packageId: activeCheckoutSession.packageId,
						stripeSessionId: activeCheckoutSession.stripeSessionId
					})
				);

				if (error !== null) {
					toast.error(closeCheckoutToastMessages[error.reason]);
				}

				return;
			}

			const [error] = await tryCatch(
				closeEmbeddedCheckoutSession({
					bookingId: activeCheckoutSession.bookingId,
					stripeSessionId: activeCheckoutSession.stripeSessionId
				})
			);

			if (error !== null) {
				toast.error(closeCheckoutToastMessages[error.reason]);
			}
		},
		[closeEmbeddedCheckoutSession, closeEmbeddedPackageCheckoutSession]
	);

	const handlePaymentModalClose = useCallback(
		(activeCheckoutSession: EmbeddedCheckoutSession) => {
			void closeOpenCheckoutSession(activeCheckoutSession);
		},
		[closeOpenCheckoutSession]
	);

	return { handlePaymentModalClose };
}
