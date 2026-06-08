import type { calendar_v3 } from "googleapis/build/src/apis/calendar/v3";
import { calculateBookingInvoiceAmounts } from "../../src/sites/studio/features/booking-invoice/lib/calculate-booking-invoice-amounts";
import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import {
	checkBookingMeetsAvailabilitySettings,
	getUtcDateForZonedDateTime,
	isTimeSlotAvailable,
	type BookingAvailabilitySettings,
} from "./bookingCalendarTime";
import { getBusyWindows } from "./googleCalendarAvailability";

type BookingEditValues = Pick<
	Doc<"bookings">,
	"accountName" | "addons" | "date" | "duration" | "email" | "name" | "phone" | "service" | "time"
> & {
	abn?: string;
	clipsPackageQuantity?: string;
	notes?: string;
	essentialEditQuantity?: string;
};

export function getBookingSessionStartAt(date: string, time: string, timeZone: string) {
	return getUtcDateForZonedDateTime(date, time, timeZone).getTime();
}

export function didBookingScheduleChange(booking: Doc<"bookings">, values: BookingEditValues) {
	return booking.date !== values.date || booking.time !== values.time;
}

export function calculateBookingRemainingBalanceAmount(
	values: Pick<
		BookingEditValues,
		"addons" | "clipsPackageQuantity" | "duration" | "essentialEditQuantity"
	>,
) {
	return calculateBookingInvoiceAmounts({
		duration: values.duration,
		addons: values.addons,
		essentialEditQuantity: values.essentialEditQuantity,
		clipsPackageQuantity: values.clipsPackageQuantity,
	}).totalDueAmount;
}

export function buildAdminBookingUpdatePatch({
	booking,
	timeZone,
	values,
}: {
	booking: Doc<"bookings">;
	timeZone: string;
	values: BookingEditValues;
}) {
	const scheduleChanged = didBookingScheduleChange(booking, values);

	return {
		name: values.name,
		phone: values.phone,
		accountName: values.accountName,
		abn: values.abn,
		email: values.email,
		date: values.date,
		time: values.time,
		duration: values.duration,
		remainingBalanceAmount: calculateBookingRemainingBalanceAmount(values),
		sessionStartAt: getBookingSessionStartAt(values.date, values.time, timeZone),
		service: values.service,
		addons: values.addons,
		essentialEditQuantity: values.essentialEditQuantity,
		clipsPackageQuantity: values.clipsPackageQuantity,
		notes: values.notes,
		...(scheduleChanged
			? {
					reminderEmailClaimedAt: undefined,
					reminderEmailSentAt: undefined,
					reminderEmailFailureCode: undefined,
				}
			: {}),
	};
}

type GoogleCalendarLike = Pick<calendar_v3.Calendar, "events">;

interface VerifyBookingCanBeScheduledArgs {
	booking: Doc<"bookings">;
	calendar: GoogleCalendarLike;
	calendarIds: string[];
	settings: BookingAvailabilitySettings;
	timeZone: string;
}

export async function failBookingCompletion(
	ctx: ActionCtx,
	bookingId: Id<"bookings">,
	failureCode: string,
) {
	await ctx.runMutation(internal.bookings.markBookingCompletionFailed, {
		bookingId,
		failureCode,
	});
}

export async function verifyBookingCanBeScheduled({
	booking,
	calendar,
	calendarIds,
	settings,
	timeZone,
}: VerifyBookingCanBeScheduledArgs) {
	try {
		checkBookingMeetsAvailabilitySettings({
			date: booking.date,
			duration: booking.duration,
			settings,
			time: booking.time,
			timeZone,
		});
	} catch {
		return false;
	}

	const busyWindows = await getBusyWindows({
		calendar,
		calendarIds,
		date: booking.date,
		timeZone,
	});

	return isTimeSlotAvailable({
		busyWindows,
		date: booking.date,
		duration: booking.duration,
		eventBufferMinutes: settings.eventBufferMinutes,
		time: booking.time,
		timeZone,
	});
}
