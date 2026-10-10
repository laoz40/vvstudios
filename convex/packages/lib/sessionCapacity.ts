import { exhaustiveCheck } from "#/lib/result";
import type { Doc } from "#convex/_generated/dataModel";

export const capacityConsumingSessionStatuses = ["confirmed", "email_failed"] as const;

export function sessionConsumesPackageCapacity(session: Pick<Doc<"bookings">, "status">) {
	switch (session.status) {
		case "confirmed":
		case "email_failed":
			return true;
		case "cancelled":
		case "pending_payment":
		case "failed":
		case "expired":
		case "abandoned":
			return false;
		default:
			return exhaustiveCheck(session.status);
	}
}
