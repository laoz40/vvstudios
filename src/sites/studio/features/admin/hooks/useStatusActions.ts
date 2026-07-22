import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { UpdateBookingEditStatusResult } from "#convex/bookings";
import {
	deliverableStatusLabelMap,
	getDeliverableStatus,
	type DeliverableStatus
} from "#studio/features/admin/lib/booking-edit-status";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";

export function useStatusActions(booking: BookingRecord) {
	const updateBookingEditStatus = useMutation(api.bookings.updateBookingEditStatus);
	const [isUpdatingEditStatus, setIsUpdatingEditStatus] = useState(false);
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
					void _exhaustive;
					break;
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

	return { deliverableStatus, handleUpdateEditStatus, isUpdatingEditStatus };
}
