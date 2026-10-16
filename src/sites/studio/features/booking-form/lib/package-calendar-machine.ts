import {
	mergeBookableRangeBusyWindows,
	type BookableRangeBusyWindowsResult,
	type BusyWindowsByMonth
} from "#studio/features/booking-form/lib/monthly-availability";

type PackageCalendarState = { busyWindowsByMonth: BusyWindowsByMonth } & (
	| { kind: "idle" }
	| { kind: "loading" }
	| { kind: "ready" }
	| { kind: "error"; message: string }
);

type PackageCalendarEvent =
	| { type: "loadStarted" }
	| { type: "loadSucceeded"; bookableMonthKeys: string[]; result: BookableRangeBusyWindowsResult }
	| { type: "loadFailed"; message: string }
	| { type: "cacheCleared" };

export const initialPackageCalendarState: PackageCalendarState = {
	kind: "idle",
	busyWindowsByMonth: {}
};

export function reducePackageCalendar(
	state: PackageCalendarState,
	event: PackageCalendarEvent
): PackageCalendarState {
	switch (event.type) {
		case "loadStarted":
			return { kind: "loading", busyWindowsByMonth: state.busyWindowsByMonth };
		case "loadSucceeded":
			return {
				kind: "ready",
				busyWindowsByMonth: mergeBookableRangeBusyWindows({
					bookableMonthKeys: event.bookableMonthKeys,
					current: state.busyWindowsByMonth,
					result: event.result
				})
			};
		case "loadFailed":
			return {
				kind: "error",
				message: event.message,
				busyWindowsByMonth: state.busyWindowsByMonth
			};
		case "cacheCleared":
			return { kind: state.kind === "loading" ? "loading" : "idle", busyWindowsByMonth: {} };
		default: {
			const exhaustive: never = event;

			return exhaustive;
		}
	}
}
