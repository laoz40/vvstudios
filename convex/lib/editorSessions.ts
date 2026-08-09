import type { Doc } from "#convex/_generated/dataModel";

export function isEditorVisibleSession(session: Doc<"bookings">): boolean {
	const hasEligibleStatus = session.status === "confirmed" || session.status === "email_failed";
	return hasEligibleStatus && session.hiddenAt === undefined;
}

export function buildEditorSessionProjection(session: Doc<"bookings">) {
	return {
		_id: session._id,
		name: session.name,
		accountName: session.accountName,
		notes: session.notes,
		date: session.date,
		time: session.time,
		duration: session.duration,
		service: session.service,
		addons: session.addons,
		essentialEditQuantity: session.essentialEditQuantity,
		clipsPackageQuantity: session.clipsPackageQuantity,
		editStatus: session.editStatus
	};
}
