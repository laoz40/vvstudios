import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { exhaustiveCheck, tryCatch } from "#/lib/result";
import {
	shouldConfirmSessionArchive,
	type SessionRecord
} from "#studio/features/admin/lib/admin-sessions";

export function useDeleteAction(session: SessionRecord) {
	const archiveSession = useMutation(api.sessions.archiveSession);
	const deleteSessionEvent = useAction(api.googleCalendar.deleteSessionFromAdmin);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isArchiveDialogOpen, setIsArchiveDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isUpdatingArchive, setIsUpdatingArchive] = useState(false);

	async function handleDeleteBooking() {
		setIsDeleting(true);

		const [error] = await tryCatch(deleteSessionEvent({ bookingId: session._id }));

		if (error !== null) {
			const reason = error.reason;

			switch (reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to cancel bookings.");
					break;
				case "BOOKING_NOT_FOUND":
					toast.error("That session no longer exists.");
					break;
				case "GOOGLE_CALENDAR_AUTH_FAILED":
					toast.error("Google Calendar authentication failed. Booking was not cancelled.");
					break;
				case "GOOGLE_CALENDAR_DELETE_FAILED":
					toast.error("Google Calendar failed to remove the event. Please try again.");
					break;
				case "GOOGLE_CALENDAR_RATE_LIMITED":
					toast.error("Google Calendar is busy right now. Wait a minute, then try again.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while cancelling the booking. Please try again.");
					break;
				default:
					exhaustiveCheck(reason);
			}

			setIsDeleting(false);

			return;
		}

		setIsDeleteDialogOpen(false);
		toast.success("Booking cancelled.");
		setIsDeleting(false);
	}

	async function handleArchiveChange(archived: boolean) {
		setIsUpdatingArchive(true);

		const [error] = await tryCatch(archiveSession({ bookingId: session._id, archived }));

		if (error !== null) {
			const reason = error.reason;

			switch (reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to archive sessions.");
					break;
				case "BOOKING_NOT_FOUND":
					toast.error("That session no longer exists.");
					break;
				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while archiving the session.");
					break;
				default:
					exhaustiveCheck(reason);
			}

			setIsUpdatingArchive(false);

			return;
		}

		toast.success(archived ? "Session archived." : "Session unarchived.");
		setIsUpdatingArchive(false);
		setIsArchiveDialogOpen(false);
	}

	function requestArchiveChange(archived: boolean) {
		if (archived && shouldConfirmSessionArchive(session)) {
			setIsArchiveDialogOpen(true);

			return;
		}

		void handleArchiveChange(archived);
	}

	async function confirmArchiveFromInbox() {
		await handleArchiveChange(true);
	}

	return {
		confirmArchiveFromInbox,
		handleArchiveChange,
		handleDeleteBooking,
		isArchiveDialogOpen,
		isUpdatingArchive,
		isDeleteDialogOpen,
		isDeleting,
		requestArchiveChange,
		setIsArchiveDialogOpen,
		setIsDeleteDialogOpen
	};
}
