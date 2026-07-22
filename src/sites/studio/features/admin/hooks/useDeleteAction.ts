import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { ArchiveSessionResult } from "#convex/bookings";
import type { DeleteBookingFromAdminResult } from "#convex/googleCalendar";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";

export function useDeleteAction(booking: BookingRecord) {
	const archiveSession = useMutation(api.bookings.archiveSession);
	const deleteBookingEvent = useAction(api.googleCalendar.deleteBookingFromAdmin);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isUpdatingArchive, setIsUpdatingArchive] = useState(false);

	async function handleDeleteBooking() {
		setIsDeleting(true);

		const [error] = await tryCatch<DeleteBookingFromAdminResult>(
			deleteBookingEvent({ bookingId: booking._id })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to delete session events.");
					break;
				case "BOOKING_NOT_FOUND":
					toast.error("That booking no longer exists.");
					break;
				case "GOOGLE_CALENDAR_AUTH_FAILED":
					toast.error("Google Calendar authentication failed. Session event was not deleted.");
					break;
				case "BOOKING_STATUS_UPDATE_FAILED":
					toast.error("The event was deleted, but the session could not be marked cancelled.");
					break;
				case "GOOGLE_CALENDAR_DELETE_FAILED":
					toast.error("Google Calendar failed to delete the event. Please try again.");
					break;
				case "GOOGLE_CALENDAR_RATE_LIMITED":
					toast.error("Google Calendar is busy right now. Wait a minute, then try deleting again.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while deleting the event. Please try again.");
					break;
				default: {
					const _exhaustive: never = error;
					void _exhaustive;
					break;
				}
			}

			setIsDeleting(false);
			return;
		}

		setIsDeleteDialogOpen(false);
		toast.success("Event deleted and session cancelled.");
		setIsDeleting(false);
	}

	async function handleArchiveChange(archived: boolean) {
		setIsUpdatingArchive(true);

		const [error] = await tryCatch<ArchiveSessionResult>(
			archiveSession({ bookingId: booking._id, archived })
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to archive sessions.");
					break;
				case "BOOKING_NOT_FOUND":
					toast.error("That session no longer exists.");
					break;
				case "SESSION_ARCHIVE_FAILED":
					toast.error("Unable to archive the session.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while archiving the session.");
					break;
				default: {
					const _exhaustive: never = error;
					void _exhaustive;
					break;
				}
			}

			setIsUpdatingArchive(false);
			return;
		}

		toast.success(archived ? "Session archived." : "Session unarchived.");
		setIsUpdatingArchive(false);
	}

	return {
		handleArchiveChange,
		handleDeleteBooking,
		isUpdatingArchive,
		isDeleteDialogOpen,
		isDeleting,
		setIsDeleteDialogOpen
	};
}
