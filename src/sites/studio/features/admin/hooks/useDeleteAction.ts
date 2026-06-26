import { useState } from "react";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { DeleteBookingFromAdminResult } from "#convex/googleCalendar";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";

export function useDeleteAction(booking: BookingRecord) {
	const deleteBooking = useAction(api.googleCalendar.deleteBookingFromAdmin);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);

	async function handleDeleteBooking() {
		setIsDeleting(true);

		const [error] = await tryCatch<DeleteBookingFromAdminResult>(
			deleteBooking({ bookingId: booking._id })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to delete bookings.");
					break;
				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					break;
				case "GOOGLE_CALENDAR_AUTH_FAILED":
					toast.error("Google Calendar authentication failed. Booking was not deleted.");
					break;
				case "BOOKING_DELETE_FAILED":
					toast.error("Could not delete the booking. Please try again.");
					break;
				case "GOOGLE_CALENDAR_DELETE_FAILED":
					toast.error("Google Calendar failed to delete the event. Please try again.");
					break;
				case "GOOGLE_CALENDAR_RATE_LIMITED":
					toast.error("Google Calendar is busy right now. Wait a minute, then try deleting again.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while deleting the booking. Please try again.");
					break;
				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsDeleting(false);
			return;
		}

		setIsDeleteDialogOpen(false);
		toast.success("Booking deleted.");
		setIsDeleting(false);
	}

	return { handleDeleteBooking, isDeleteDialogOpen, isDeleting, setIsDeleteDialogOpen };
}
