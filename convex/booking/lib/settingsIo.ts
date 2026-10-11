import { api } from "#convex/_generated/api";
import type { ActionCtx } from "#convex/_generated/server";
import type { ResultAsync } from "neverthrow";
import { okOrThrow } from "#convex/shared/lib/result";
import type { BookingAvailabilitySettings } from "#studio/lib/bookingAvailabilitySettings";

export function queryBookingAvailabilitySettings(
	ctx: ActionCtx
): ResultAsync<BookingAvailabilitySettings, never> {
	return okOrThrow(ctx.runQuery(api.booking.settings.get, {}));
}
