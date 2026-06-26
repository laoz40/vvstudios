import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type {
	UpdateBookingPaidRemainingBalanceResult,
	UpdateBookingRemainingBalanceAmountResult
} from "#convex/bookings";
import { getRemainingBalanceAmount } from "#studio/features/admin/lib/remaining-balance";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";

export function usePaymentActions(booking: BookingRecord) {
	const updateBookingPaidRemainingBalance = useMutation(
		api.bookings.updateBookingPaidRemainingBalance
	);
	const updateBookingRemainingBalanceAmount = useMutation(
		api.bookings.updateBookingRemainingBalanceAmount
	);
	const [isRemainingBalanceDialogOpen, setIsRemainingBalanceDialogOpen] = useState(false);
	const [isUpdatingPaidRemainingBalance, setIsUpdatingPaidRemainingBalance] = useState(false);
	const [isUpdatingRemainingBalanceAmount, setIsUpdatingRemainingBalanceAmount] = useState(false);

	const isPaidRemainingBalance = booking.paidRemainingBalance === true;
	const remainingBalanceAmount = getRemainingBalanceAmount(booking);
	const [remainingBalanceDraft, setRemainingBalanceDraft] = useState(
		String(remainingBalanceAmount)
	);

	// Keep the remaining balance draft fresh each time the dialog opens.
	useEffect(() => {
		if (isRemainingBalanceDialogOpen) {
			setRemainingBalanceDraft(String(remainingBalanceAmount));
		}
	}, [isRemainingBalanceDialogOpen, remainingBalanceAmount]);

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

	async function handleSetRemainingBalanceAmount() {
		const parsedAmount = Number(remainingBalanceDraft);

		if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
			toast.error("Enter a valid remaining balance.");
			return;
		}

		setIsUpdatingRemainingBalanceAmount(true);

		const [error] = await tryCatch<UpdateBookingRemainingBalanceAmountResult>(
			updateBookingRemainingBalanceAmount({
				bookingId: booking._id,
				remainingBalanceAmount: parsedAmount
			})
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
				case "BOOKING_REMAINING_BALANCE_AMOUNT_UPDATE_FAILED":
					toast.error("Could not update the remaining balance. Please try again.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while updating the remaining balance.");
					break;
				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsUpdatingRemainingBalanceAmount(false);
			return;
		}

		setIsRemainingBalanceDialogOpen(false);
		toast.success("Remaining balance updated.");
		setIsUpdatingRemainingBalanceAmount(false);
	}

	return {
		handleSetPaidRemainingBalance,
		handleSetRemainingBalanceAmount,
		isPaidRemainingBalance,
		isRemainingBalanceDialogOpen,
		isUpdatingPaidRemainingBalance,
		isUpdatingRemainingBalanceAmount,
		remainingBalanceAmount,
		remainingBalanceDraft,
		setIsRemainingBalanceDialogOpen,
		setRemainingBalanceDraft
	};
}
