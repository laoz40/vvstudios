import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { UpdateBookingPaidRemainingBalanceResult } from "#convex/bookings";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";

export function usePaymentActions(booking: BookingRecord) {
	const updateBookingPaidRemainingBalance = useMutation(
		api.bookings.updateBookingPaidRemainingBalance
	);
	const [isUpdatingPaidRemainingBalance, setIsUpdatingPaidRemainingBalance] = useState(false);

	const isPaidRemainingBalance = booking.paidRemainingBalance === true;

	async function handleSetPaidRemainingBalance(paidRemainingBalance: boolean) {
		setIsUpdatingPaidRemainingBalance(true);

		const [error] = await tryCatch<UpdateBookingPaidRemainingBalanceResult>(
			updateBookingPaidRemainingBalance({ bookingId: booking._id, paidRemainingBalance })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to update bookings.");
					break;
				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					break;
				case "BOOKING_PAID_REMAINING_BALANCE_UPDATE_FAILED":
					toast.error("Could not update the payment status. Please try again.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while updating the payment status.");
					break;
				default: {
					const _exhaustive: never = error;
					return _exhaustive;
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
