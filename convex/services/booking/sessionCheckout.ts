import type { MutationCtx } from "#convex/_generated/server";
import { getBookingAvailabilitySettings } from "#convex/lib/booking/bookingSettings";
import {
	type CreatePendingCheckoutSessionArgs,
	buildPendingPaymentBookingFields,
	findPendingPaymentBookingAtStartTime,
	insertPendingPaymentBooking,
	rejectPendingPaymentSlotConflict,
	resolveCheckoutDriveClientId,
	validateCheckoutSessionAvailability
} from "#convex/lib/sessions/pendingCheckoutSession";

export function assertCheckoutSessionAvailable(
	ctx: MutationCtx,
	args: Pick<CreatePendingCheckoutSessionArgs, "date" | "duration" | "time">
) {
	return getBookingAvailabilitySettings(ctx).andThen((settings) =>
		validateCheckoutSessionAvailability(settings, args)
	);
}

export function createPendingCheckoutBooking(
	ctx: MutationCtx,
	args: CreatePendingCheckoutSessionArgs,
	sessionStartAt: number
) {
	return findPendingPaymentBookingAtStartTime(ctx, sessionStartAt)
		.andThen(rejectPendingPaymentSlotConflict)
		.andThen(() => resolveCheckoutDriveClientId(ctx, args))
		.andThen((driveClientId) => {
			const bookingFields = buildPendingPaymentBookingFields(args, sessionStartAt, driveClientId);

			return insertPendingPaymentBooking(ctx, bookingFields);
		});
}
