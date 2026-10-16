import type { Id } from "#convex/_generated/dataModel";

export interface PackageSessionOperationState {
	savingSessionKey: string | null;
	unschedulingBookingId: Id<"bookings"> | null;
}

export type PackageSessionOperationEvent =
	| { type: "saveStarted"; sessionKey: string }
	| { type: "saveFinished" }
	| { type: "unscheduleStarted"; bookingId: Id<"bookings"> }
	| { type: "unscheduleFinished" };

export const initialPackageSessionOperationState: PackageSessionOperationState = {
	savingSessionKey: null,
	unschedulingBookingId: null
};

export function reducePackageSessionOperation(
	state: PackageSessionOperationState,
	event: PackageSessionOperationEvent
): PackageSessionOperationState {
	switch (event.type) {
		case "saveStarted":
			return { ...state, savingSessionKey: event.sessionKey };
		case "saveFinished":
			return { ...state, savingSessionKey: null };
		case "unscheduleStarted":
			return { ...state, unschedulingBookingId: event.bookingId };
		case "unscheduleFinished":
			return { ...state, unschedulingBookingId: null };
		default: {
			const exhaustive: never = event;

			return exhaustive;
		}
	}
}
