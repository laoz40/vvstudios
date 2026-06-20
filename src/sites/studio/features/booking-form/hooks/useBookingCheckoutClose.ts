import { useCallback } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import type { CloseEmbeddedCheckoutSessionResult } from "#convex/stripe";
import { api } from "#convex/_generated/api";
import type { EmbeddedCheckoutSession } from "#studio/features/booking-form/lib/checkout-session";
import { closeCheckoutToastMessages } from "#studio/features/booking-form/lib/booking-page-errors";
import { tryCatch } from "#/lib/result";

export function useBookingCheckoutClose() {
	const closeEmbeddedCheckoutSession = useAction(api.stripe.closeEmbeddedCheckoutSession);

	const closeOpenCheckoutSession = useCallback(
		async (activeCheckoutSession: EmbeddedCheckoutSession) => {
			const [error] = await tryCatch<CloseEmbeddedCheckoutSessionResult>(
				closeEmbeddedCheckoutSession({
					bookingId: activeCheckoutSession.bookingId,
					stripeSessionId: activeCheckoutSession.stripeSessionId
				})
			);

			if (error !== null) {
				toast.error(closeCheckoutToastMessages[error.reason]);
			}
		},
		[closeEmbeddedCheckoutSession]
	);

	const handlePaymentModalClose = useCallback(
		(activeCheckoutSession: EmbeddedCheckoutSession) => {
			void closeOpenCheckoutSession(activeCheckoutSession);
		},
		[closeOpenCheckoutSession]
	);

	return { handlePaymentModalClose };
}
