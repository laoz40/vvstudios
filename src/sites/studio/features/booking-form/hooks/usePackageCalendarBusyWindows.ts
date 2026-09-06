import { useCallback, useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import {
	mergeBookableRangeBusyWindows,
	type BusyWindowsByMonth
} from "#studio/features/booking-form/lib/monthly-availability";
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
	const getPackageBusyWindows = useAction(api.packageSchedulingCalendar.getPackageBusyWindows);
	const [rateLimitKey, setRateLimitKey] = useState<string | null>(null);
	const [calendarLoadError, setCalendarLoadError] = useState("");
	const [busyWindowsByMonth, setBusyWindowsByMonth] = useState<BusyWindowsByMonth>({});
	const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

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
		setIsLoadingCalendar(true);
		const activeRateLimitKey = rateLimitKey;

		async function loadBusyWindows() {
			const [busyWindowsError, result] = await tryCatch(
				getPackageBusyWindows({ rateLimitKey: activeRateLimitKey, token })
			);

			if (isCancelled) {
				return;
			}

			setIsLoadingCalendar(false);

			if (busyWindowsError !== null) {
				console.error("Failed to load package calendar busy windows", busyWindowsError);
				setCalendarLoadError(getPackageAvailabilityErrorMessage(busyWindowsError));
				return;
			}

			setBusyWindowsByMonth((current) =>
				mergeBookableRangeBusyWindows({ bookableMonthKeys, current, result })
			);
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
		setBusyWindowsByMonth({});
	}, []);

	return { busyWindowsByMonth, calendarLoadError, invalidateCalendarCache, isLoadingCalendar };
}
