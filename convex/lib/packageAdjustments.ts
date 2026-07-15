import type { Doc, Id } from "../_generated/dataModel";
import { ADDON_PRICES } from "../../src/sites/studio/features/booking-form/lib/booking-pricing";

const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
export const PACKAGE_ADJUSTMENT_PAYMENT_DUE_MS = 7 * 24 * MILLISECONDS_PER_HOUR;
export const REMOTE_PODCAST_ADJUSTMENT_RATE = ADDON_PRICES["Remote Podcast"];

type PackageAdjustmentEvaluation =
	| { kind: "wait_for_sessions_to_end"; nextCheckAt: number }
	| { kind: "invalid_duration" }
	| {
			kind: "ready";
			remotePodcastBookingIds: Id<"bookings">[];
			quantity: number;
			totalAmount: number;
	  };

export function evaluatePackageAdjustment(
	bookings: Doc<"bookings">[],
	now: number
): PackageAdjustmentEvaluation {
	const completedBookings: Doc<"bookings">[] = [];
	let latestOngoingSessionEndAt = 0;

	for (const booking of bookings) {
		const sessionEndAt = getPackageSessionEndAt(booking);

		if (sessionEndAt === null) {
			return { kind: "invalid_duration" };
		}

		if (sessionEndAt > now) {
			latestOngoingSessionEndAt = Math.max(latestOngoingSessionEndAt, sessionEndAt);
			continue;
		}

		completedBookings.push(booking);
	}

	if (latestOngoingSessionEndAt > 0) {
		return { kind: "wait_for_sessions_to_end", nextCheckAt: latestOngoingSessionEndAt };
	}

	const remotePodcastBookingIds = completedBookings
		.filter((booking) => booking.addons.includes("Remote Podcast"))
		.map((booking) => booking._id);
	const quantity = remotePodcastBookingIds.length;

	return {
		kind: "ready",
		remotePodcastBookingIds,
		quantity,
		totalAmount: quantity * REMOTE_PODCAST_ADJUSTMENT_RATE
	};
}

function getPackageSessionEndAt(booking: Pick<Doc<"bookings">, "duration" | "sessionStartAt">) {
	switch (booking.duration) {
		case "1h":
			return booking.sessionStartAt + MILLISECONDS_PER_HOUR;
		case "2h":
			return booking.sessionStartAt + 2 * MILLISECONDS_PER_HOUR;
		case "3h":
			return booking.sessionStartAt + 3 * MILLISECONDS_PER_HOUR;
		default:
			return null;
	}
}
