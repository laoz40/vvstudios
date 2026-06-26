import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { UpdateBookingEditStatusResult, UpdateBookingStatusResult } from "#convex/bookings";
import {
	deliverableStatusLabelMap,
	getDeliverableStatus,
	type DeliverableStatus
} from "#studio/features/admin/lib/booking-edit-status";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";

type UseBookingStatusActionsOptions = {
	canToggleStatus: boolean;
	nextStatus: "confirmed" | "failed";
};

export function useStatusActions(
	booking: BookingRecord,
	{ canToggleStatus, nextStatus }: UseBookingStatusActionsOptions
) {
	const updateBookingEditStatus = useMutation(api.bookings.updateBookingEditStatus);
	const updateBookingStatus = useMutation(api.bookings.updateBookingStatus);
	const [isUpdatingEditStatus, setIsUpdatingEditStatus] = useState(false);
	const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
	const deliverableStatus = getDeliverableStatus(booking);

	async function handleUpdateEditStatus(nextEditStatus: DeliverableStatus) {
		setIsUpdatingEditStatus(true);

		const [error] = await tryCatch<UpdateBookingEditStatusResult>(
			updateBookingEditStatus({ bookingId: booking._id, editStatus: nextEditStatus })
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
				case "BOOKING_EDIT_STATUS_UPDATE_FAILED":
					toast.error("Could not update the deliverables status. Please try again.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while updating the deliverables status.");
					break;
				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsUpdatingEditStatus(false);
			return;
		}

		toast.success(
			`Deliverable status changed to ${deliverableStatusLabelMap[nextEditStatus].toLowerCase()}.`
		);
		setIsUpdatingEditStatus(false);
	}

	async function handleToggleStatus() {
		if (!canToggleStatus) {
			return;
		}

		setIsUpdatingStatus(true);

		const [error] = await tryCatch<UpdateBookingStatusResult>(
			updateBookingStatus({ bookingId: booking._id, status: nextStatus })
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
				case "INVALID_BOOKING_STATUS_TRANSITION":
					toast.error("This booking status cannot be changed here.");
					break;
				case "BOOKING_STATUS_UPDATE_FAILED":
					toast.error("Could not update the booking status. Please try again.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while updating the booking status.");
					break;
				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsUpdatingStatus(false);
			return;
		}

		toast.success(
			nextStatus === "confirmed"
				? "Booking marked as confirmed."
				: "Booking marked as needs follow up."
		);
		setIsUpdatingStatus(false);
	}

	return {
		deliverableStatus,
		handleToggleStatus,
		handleUpdateEditStatus,
		isUpdatingEditStatus,
		isUpdatingStatus
	};
}
