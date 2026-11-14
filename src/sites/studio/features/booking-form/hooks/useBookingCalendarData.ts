import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAction, useQuery as useConvexQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import { tryCatch } from "#/lib/result";
import { getBookableDateRange } from "#studio/features/booking-form/lib/availability-picker-machine";
import {
	getCalendarAvailability,
	type BookingCalendarSource
} from "#studio/features/booking-form/lib/booking-calendar-source";
import {
	getBookableMonthKeys,
	mergeBookableRangeBusyWindows
} from "#studio/features/booking-form/lib/monthly-availability";
import { getAvailabilityRateLimitKey } from "#studio/features/booking-form/lib/saved-booking-info";
import { DEFAULT_BOOKING_AVAILABILITY_SETTINGS } from "#studio/lib/bookingdatetime";

export function useBookingCalendarData({
	source,
	currentTimestamp
}: {
	source: BookingCalendarSource;
	currentTimestamp: number;
}) {
	const settings = useConvexQuery(api.booking.settings.get, {});
	const fetchBookingWindows = useAction(api.googleCalendar.calendar.getBookableRangeBusyWindows);

	const fetchRescheduleWindows = useAction(
		api.googleCalendar.calendar.getRescheduleBookableRangeBusyWindows
	);

	const dateRange = getBookableDateRange({
		currentTimestamp,
		settings: settings ?? DEFAULT_BOOKING_AVAILABILITY_SETTINGS
	});

	const bookableMonthKeys = getBookableMonthKeys(dateRange.today, dateRange.lastBookableDate);
	const rescheduleToken = source.kind === "reschedule" ? source.token : null;
	const isPreview = source.kind === "reschedule" && Boolean(source.devScenario);

	const query = useQuery({
		enabled: typeof window !== "undefined" && !isPreview,
		queryKey: ["booking-calendar", source.kind, rescheduleToken, bookableMonthKeys],
		queryFn: async () => {
			// This browser identifier controls quota, not the contents of the cached calendar.
			const rateLimitKey = getAvailabilityRateLimitKey();

			const request =
				source.kind === "booking"
					? fetchBookingWindows({ rateLimitKey })
					: fetchRescheduleWindows({ rateLimitKey, token: source.token });

			const [error, result] = await tryCatch(request);

			if (error !== null) {
				throw error;
			}

			return mergeBookableRangeBusyWindows({ bookableMonthKeys, current: {}, result });
		},
		staleTime: source.kind === "booking" ? 60_000 : 0
	});

	const availability = getCalendarAvailability({ source, query });

	const errorMessage =
		source.kind === "booking" && availability.kind === "error" ? availability.error.message : "";

	useEffect(() => {
		if (errorMessage) {
			toast.error(errorMessage);
		}
	}, [query.error, errorMessage]);

	return { availability, dateRange };
}
