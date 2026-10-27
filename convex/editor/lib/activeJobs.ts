import type { Doc } from "#convex/_generated/dataModel";
import { parseDurationMinutes } from "#convex/sessions/lib/calendarTime";

export function isActiveEditorJob(booking: Doc<"bookings">, now: number) {
	if (
		(booking.status !== "confirmed" && booking.status !== "email_failed") ||
		booking.editStatus === "completed"
	) {
		return false;
	}

	const duration = parseDurationMinutes(booking.duration);

	return duration.isOk() && booking.sessionStartAt + duration.value * 60_000 <= now;
}

export function listActiveEditorJobs(bookings: Doc<"bookings">[], now: number) {
	return bookings.flatMap((booking) => {
		if (!isActiveEditorJob(booking, now)) return [];

		const {
			_id,
			name,
			accountName,
			date,
			time,
			duration,
			service,
			addons,
			essentialEditQuantity,
			completeEditQuantity,
			clipsPackageQuantity,
			handcraftedClipsQuantity,
			editorDueDate,
			adminNotes,
			editorNotes,
			editStatus,
			sessionStartAt
		} = booking;

		return [
			{
				_id,
				name,
				accountName,
				date,
				time,
				duration,
				service,
				addons,
				essentialEditQuantity,
				completeEditQuantity,
				clipsPackageQuantity,
				handcraftedClipsQuantity,
				editorDueDate,
				adminNotes,
				editorNotes,
				editStatus,
				sessionStartAt
			}
		];
	});
}
