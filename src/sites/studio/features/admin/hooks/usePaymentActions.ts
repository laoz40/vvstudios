import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { UpdateSessionPaidStatusResult } from "#convex/sessions";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";

export function usePaymentActions(session: SessionRecord) {
	const updateSessionPaidStatus = useMutation(api.sessions.updateSessionPaidStatus);
	const [isUpdatingPaidRemainingBalance, setIsUpdatingPaidRemainingBalance] = useState(false);

	const isPaidRemainingBalance = session.paidRemainingBalance === true;

	async function handleSetPaidRemainingBalance(paidRemainingBalance: boolean) {
		setIsUpdatingPaidRemainingBalance(true);

		const [error] = await tryCatch<UpdateSessionPaidStatusResult>(
			updateSessionPaidStatus({ bookingId: session._id, paidRemainingBalance })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to update sessions.");
					break;
				case "BOOKING_NOT_FOUND":
					toast.error("That session no longer exists.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while updating the payment status.");
					break;
				default: {
					const _exhaustive: never = error;
					void _exhaustive;
					break;
				}
			}

			setIsUpdatingPaidRemainingBalance(false);
			return;
		}

		toast.success(
			paidRemainingBalance
				? "Remaining balance marked as paid."
				: "Remaining balance marked as unpaid."
		);
		setIsUpdatingPaidRemainingBalance(false);
	}

	return { handleSetPaidRemainingBalance, isPaidRemainingBalance, isUpdatingPaidRemainingBalance };
}
