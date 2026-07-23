import { useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import type { UpdateSessionEditStatusResult } from "#convex/sessions";
import {
	deliverableStatusLabelMap,
	getDeliverableStatus,
	type DeliverableStatus
} from "#studio/features/admin/lib/session-edit-status";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";

export function useStatusActions(session: SessionRecord) {
	const updateSessionEditStatus = useMutation(api.sessions.updateSessionEditStatus);
	const [isUpdatingEditStatus, setIsUpdatingEditStatus] = useState(false);
	const deliverableStatus = getDeliverableStatus(session);

	async function handleUpdateEditStatus(nextEditStatus: DeliverableStatus) {
		setIsUpdatingEditStatus(true);

		const [error] = await tryCatch<UpdateSessionEditStatusResult>(
			updateSessionEditStatus({ bookingId: session._id, editStatus: nextEditStatus })
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
