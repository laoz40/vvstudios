import { useCallback, useEffect, useReducer, useState } from "react";
import { useAction } from "convex/react";
import { api } from "#convex/_generated/api";
import { logError } from "#convex/shared/lib/logger";
import { tryCatch } from "#/lib/result";
import type { BusyWindowsByMonth } from "#studio/features/booking-form/lib/monthly-availability";
import {
	initialPackageCalendarState,
	reducePackageCalendar
} from "#studio/features/booking-form/lib/package-calendar-machine";
import { getPackageAvailabilityErrorMessage } from "#studio/features/booking-form/lib/package-scheduling-errors";
import { getAvailabilityRateLimitKey } from "#studio/features/booking-form/lib/saved-booking-info";

interface UsePackageCalendarBusyWindowsOptions {
	bookableMonthKeys: string[];
	token: string;
}

interface PackageCalendarBusyWindowsState {
	busyWindowsByMonth: BusyWindowsByMonth;
	calendarLoadError: string;
	invalidateCalendarCache: () => void;
	isLoadingCalendar: boolean;
}

export function usePackageCalendarBusyWindows({
	bookableMonthKeys,
	token
}: UsePackageCalendarBusyWindowsOptions): PackageCalendarBusyWindowsState {
	const getPackageBusyWindows = useAction(api.packages.schedulingCalendar.getPackageBusyWindows);

	const [rateLimitKey, setRateLimitKey] = useState<string | null>(null);

	const [calendar, dispatch] = useReducer(reducePackageCalendar, initialPackageCalendarState);
	const { busyWindowsByMonth } = calendar;
	const calendarLoadError = calendar.kind === "error" ? calendar.message : "";
	const isLoadingCalendar = calendar.kind === "loading";

	useEffect(() => {
		setRateLimitKey(getAvailabilityRateLimitKey());
	}, []);

	useEffect(() => {
		if (!rateLimitKey || calendarLoadError) {
			return undefined;
		}

		const hasAllMonthsCached = bookableMonthKeys.every((month) =>
			Object.hasOwn(busyWindowsByMonth, month)
		);

		if (bookableMonthKeys.length === 0 || hasAllMonthsCached) {
			return undefined;
		}

		let isCancelled = false;
		dispatch({ type: "loadStarted" });
		const activeRateLimitKey = rateLimitKey;

		async function loadBusyWindows() {
			const [busyWindowsError, result] = await tryCatch(
				getPackageBusyWindows({ rateLimitKey: activeRateLimitKey, token })
			);

			if (isCancelled) {
				return;
			}

			if (busyWindowsError !== null) {
				if (
					[
						"GOOGLE_CALENDAR_AUTH_FAILED",
						"GOOGLE_CALENDAR_AVAILABILITY_FAILED",
						"GOOGLE_CALENDAR_RATE_LIMITED",
						"UNEXPECTED_ERROR"
					].includes(busyWindowsError.reason)
				) {
					logError(
						{ operation: "packages.loadCalendarAvailability", reason: busyWindowsError.reason },
						busyWindowsError
					);
				}

				dispatch({
					type: "loadFailed",
					message: getPackageAvailabilityErrorMessage(busyWindowsError)
				});

				return;
			}

			dispatch({ type: "loadSucceeded", bookableMonthKeys, result });
		}

		void loadBusyWindows();

		return () => {
			isCancelled = true;
		};
	}, [
		bookableMonthKeys,
		busyWindowsByMonth,
		calendarLoadError,
		getPackageBusyWindows,
		rateLimitKey,
		token
	]);

	const invalidateCalendarCache = useCallback(() => {
		dispatch({ type: "cacheCleared" });
	}, []);

	return { busyWindowsByMonth, calendarLoadError, invalidateCalendarCache, isLoadingCalendar };
}
