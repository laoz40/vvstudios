import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import {
	getDevRescheduleAvailabilityStatus,
	type DevRescheduleScenario
} from "#studio/components/booking/RescheduleDevScenarioPanel";
import {
	mergeBookableRangeBusyWindows,
	type BusyWindowsByMonth
} from "#studio/features/booking-form/lib/monthly-availability";
import {
	getAvailabilityErrorMessage,
	isRescheduleBusyWindowsLoadError,
	resolveRescheduleBusyWindowsLoadError,
	type RescheduleLinkInvalidContent
} from "#studio/features/booking-form/lib/reschedule-errors";
import { getAvailabilityRateLimitKey } from "#studio/features/booking-form/lib/saved-booking-info";

interface UseRescheduleBusyWindowsOptions {
	activeDevScenario: DevRescheduleScenario | undefined;
	bookableMonthKeys: string[];
	token: string;
}

interface RescheduleBusyWindowsState {
	availabilityError: string;
	clearInvalidLinkMessage: () => void;
	invalidLinkMessage: RescheduleLinkInvalidContent | null;
	isLoadingMonthAvailability: boolean;
	monthlyBusyWindowsByMonth: BusyWindowsByMonth;
}

export function useRescheduleBusyWindows({
	activeDevScenario,
	bookableMonthKeys,
	token
}: UseRescheduleBusyWindowsOptions): RescheduleBusyWindowsState {
	const queryClient = useQueryClient();
	const fetchRescheduleBusyWindows = useAction(
		api.googleCalendar.getRescheduleBookableRangeBusyWindows
	);

	// Reuse the same browser key for Google Calendar rate limiting across visits.
	const [availabilityRateLimitKey] = useState(getAvailabilityRateLimitKey);
	const [devAvailabilityError, setDevAvailabilityError] = useState("");

	// TanStack Query owns fetch, cache, and loading for this Convex action.
	const busyWindowsQuery = useQuery({
		enabled: Boolean(availabilityRateLimitKey) && !activeDevScenario,
		queryKey: ["reschedule-busy-windows", token, availabilityRateLimitKey, bookableMonthKeys],
		queryFn: async () => {
			const [error, result] = await tryCatch(
				fetchRescheduleBusyWindows({ rateLimitKey: availabilityRateLimitKey, token })
			);

			if (error !== null) {
				throw error;
			}

			return mergeBookableRangeBusyWindows({ bookableMonthKeys, current: {}, result });
		}
	});

	// Dev panel can fake availability errors without hitting Google Calendar.
	useEffect(() => {
		if (!activeDevScenario) {
			setDevAvailabilityError("");
			return;
		}

		const devAvailabilityStatus = getDevRescheduleAvailabilityStatus(activeDevScenario);
		if (devAvailabilityStatus.kind !== "availabilityError") {
			setDevAvailabilityError("");
			return;
		}

		setDevAvailabilityError(getAvailabilityErrorMessage(devAvailabilityStatus.error));
	}, [activeDevScenario]);

	// Reschedule errors split into an invalid-link screen vs an inline availability message.
	const fetchErrorOutcome = useMemo(() => {
		if (!isRescheduleBusyWindowsLoadError(busyWindowsQuery.error)) {
			return null;
		}

		return resolveRescheduleBusyWindowsLoadError(busyWindowsQuery.error);
	}, [busyWindowsQuery.error]);

	const invalidLinkMessage =
		fetchErrorOutcome?.kind === "invalidLink" ? fetchErrorOutcome.content : null;
	const fetchAvailabilityError =
		fetchErrorOutcome?.kind === "availabilityError" ? fetchErrorOutcome.message : "";

	useEffect(() => {
		if (!isRescheduleBusyWindowsLoadError(busyWindowsQuery.error)) {
			return;
		}

		if (fetchErrorOutcome?.kind === "availabilityError") {
			console.error("Failed to load reschedule availability", busyWindowsQuery.error);
		}
	}, [busyWindowsQuery.error, fetchErrorOutcome]);

	// Clears an invalid-link fetch error when dev scenarios reset the page state.
	const clearInvalidLinkMessage = useCallback(() => {
		if (!availabilityRateLimitKey) {
			return;
		}

		// Query key must match useQuery above.
		void queryClient.resetQueries({
			queryKey: ["reschedule-busy-windows", token, availabilityRateLimitKey, bookableMonthKeys]
		});
	}, [availabilityRateLimitKey, bookableMonthKeys, queryClient, token]);

	return {
		availabilityError: devAvailabilityError || fetchAvailabilityError,
		clearInvalidLinkMessage,
		invalidLinkMessage,
		isLoadingMonthAvailability: busyWindowsQuery.isPending,
		monthlyBusyWindowsByMonth: busyWindowsQuery.data ?? {}
	};
}
