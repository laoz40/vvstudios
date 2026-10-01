import type { UserIdentity } from "convex/server";
import type { Doc } from "#convex/_generated/dataModel";
import { isAdminIdentity } from "#convex/lib/auth";

type EditStatus = NonNullable<Doc<"bookings">["editStatus"]>;

export function shouldNotifyHostOfDeliverablesReview(args: {
	identity: UserIdentity;
	previousEditStatus: EditStatus | undefined;
	nextEditStatus: EditStatus;
}) {
	return (
		args.nextEditStatus === "review" &&
		args.previousEditStatus !== "review" &&
		!isAdminIdentity(args.identity)
	);
}
