import type { FunctionReturnType } from "convex/server";
import { api } from "#convex/_generated/api";
import type { Id } from "#convex/_generated/dataModel";
import { tryCatch, type UnexpectedError } from "#/lib/result";
import type { BookingFormValues } from "#studio/features/booking-form/lib/booking-form-model";

type PackageData = NonNullable<
	FunctionReturnType<typeof api.packageScheduling.getPackageByToken>[1]
>;
export type PackageSession = PackageData["sessions"][number];
type SavePackageBookingError =
	| NonNullable<FunctionReturnType<typeof api.packageScheduling.createPackageSession>[0]>
	| NonNullable<FunctionReturnType<typeof api.packageScheduling.reschedulePackageSession>[0]>
	| UnexpectedError;
type UnschedulePackageSessionError =
	| NonNullable<FunctionReturnType<typeof api.packageScheduling.unschedulePackageSession>[0]>
	| UnexpectedError;

export type PackageSessionInput = {
	date: string;
	time: string;
	service: Exclude<BookingFormValues["service"], "">;
	notes: string;
	remotePodcast: boolean;
	token: string;
};

export type PackageSessionSaveOutcome =
	| { status: "error"; error: SavePackageBookingError }
	| { status: "saved"; bookingId: Id<"bookings">; wasReschedule: boolean };

export type PackageSessionUnscheduleOutcome =
	| { status: "error"; error: UnschedulePackageSessionError }
	| { status: "unscheduled" };

export async function performPackageSessionSave(
	activeBooking: PackageSession | undefined,
	sessionInput: PackageSessionInput,
	createPackageSession: (
		input: PackageSessionInput
	) => Promise<FunctionReturnType<typeof api.packageScheduling.createPackageSession>>,
	reschedulePackageSession: (
		input: PackageSessionInput & { bookingId: Id<"bookings"> }
	) => Promise<FunctionReturnType<typeof api.packageScheduling.reschedulePackageSession>>
): Promise<PackageSessionSaveOutcome> {
	const saveOutcome = activeBooking
		? await tryCatch(reschedulePackageSession({ bookingId: activeBooking._id, ...sessionInput }))
		: await tryCatch(createPackageSession(sessionInput));
	const [saveError, saveResult] = saveOutcome;

	if (saveError !== null) {
		return { status: "error", error: saveError };
	}

	return {
		status: "saved",
		bookingId: saveResult.bookingId,
		wasReschedule: activeBooking !== undefined
	};
}

export async function performPackageSessionUnschedule(
	bookingId: Id<"bookings">,
	token: string,
	unschedulePackageSession: (input: {
		bookingId: Id<"bookings">;
		token: string;
	}) => Promise<FunctionReturnType<typeof api.packageScheduling.unschedulePackageSession>>
): Promise<PackageSessionUnscheduleOutcome> {
	const [unscheduleError] = await tryCatch(unschedulePackageSession({ bookingId, token }));

	if (unscheduleError !== null) {
		return { status: "error", error: unscheduleError };
	}

	return { status: "unscheduled" };
}
