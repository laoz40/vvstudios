import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAction } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import { availabilityErrorMessages } from "#studio/features/booking-form/lib/booking-page-errors";
import {
	mergeBookableRangeBusyWindows,
	type BusyWindowsByMonth
} from "#studio/features/booking-form/lib/monthly-availability";
import { getAvailabilityRateLimitKey } from "#studio/features/booking-form/lib/saved-booking-info";

interface UseBookingBusyWindowsOptions {
	bookableMonthKeys: string[];
}

interface BookingBusyWindowsState {
	fetchAvailabilityError: string;
	isLoadingMonthAvailability: boolean;
	monthlyBusyWindowsByMonth: BusyWindowsByMonth;
}

function isBookingBusyWindowsLoadError(
	error: unknown
): error is { reason: keyof typeof availabilityErrorMessages } {
	return (
		typeof error === "object" &&
		error !== null &&
		"reason" in error &&
		typeof error.reason === "string" &&
		error.reason in availabilityErrorMessages
	);
}

export function useBookingBusyWindows({
	bookableMonthKeys
}: UseBookingBusyWindowsOptions): BookingBusyWindowsState {
	const fetchBookableRangeBusyWindows = useAction(api.googleCalendar.getBookableRangeBusyWindows);

	// Reuse the same browser key for Google Calendar rate limiting across visits.
	const [availabilityRateLimitKey] = useState(getAvailabilityRateLimitKey);

	// TanStack Query owns fetch, cache, and loading for this Convex action.
	const busyWindowsQuery = useQuery({
		enabled: Boolean(availabilityRateLimitKey),
		queryKey: ["booking-busy-windows", availabilityRateLimitKey, bookableMonthKeys],
		queryFn: async () => {
			const [error, result] = await tryCatch(
				fetchBookableRangeBusyWindows({ rateLimitKey: availabilityRateLimitKey })
			);

			if (error !== null) {
				throw error;
			}

			return mergeBookableRangeBusyWindows({ bookableMonthKeys, current: {}, result });
		}
	});

	// Turn the thrown Convex error into copy for the booking form.
	const fetchAvailabilityError = useMemo(() => {
		if (!isBookingBusyWindowsLoadError(busyWindowsQuery.error)) {
			return "";
		}

		return availabilityErrorMessages[busyWindowsQuery.error.reason];
	}, [busyWindowsQuery.error]);

	// Booking shows fetch failures as a toast as well as inline form error.
	useEffect(() => {
		if (!fetchAvailabilityError) {
			return;
		}

		console.error("Booking availability failed", busyWindowsQuery.error);
		toast.error(fetchAvailabilityError);
	}, [busyWindowsQuery.error, fetchAvailabilityError]);

	return {
		fetchAvailabilityError,
		isLoadingMonthAvailability: busyWindowsQuery.isPending,
		monthlyBusyWindowsByMonth: busyWindowsQuery.data ?? {}
	};
}
