import type { UserIdentity } from "convex/server";
import type { Doc } from "#convex/_generated/dataModel";

export type DeliverablesAccess = { identity: UserIdentity; session: Doc<"bookings"> };
