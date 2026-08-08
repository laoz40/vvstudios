import { useState } from "react";
import { useAction, useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";

export function useDeleteAction(session: SessionRecord) {
	const archiveSession = useMutation(api.sessions.archiveSession);
	const deleteSessionEvent = useAction(api.googleCalendar.deleteSessionFromAdmin);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
	const [isDeleting, setIsDeleting] = useState(false);
	const [isUpdatingArchive, setIsUpdatingArchive] = useState(false);

	async function handleDeleteBooking() {
		setIsDeleting(true);

		const [error] = await tryCatch(deleteSessionEvent({ bookingId: session._id }));

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;
				case "NOT_AUTHORIZED":
					toast.error("You do not have access to delete session events.");
					break;
				case "BOOKING_NOT_FOUND":
					toast.error("That session no longer exists.");
					break;
				case "GOOGLE_CALENDAR_AUTH_FAILED":
					toast.error("Google Calendar authentication failed. Session event was not deleted.");
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

		const [error] = await tryCatch(archiveSession({ bookingId: session._id, archived }));

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
