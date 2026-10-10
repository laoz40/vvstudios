import { v } from "convex/values";

/** Google Drive permission stored on bookings / driveSessions and passed to internal mutations. */
export const drivePermissionValidator = v.object({
	id: v.string(),
	emailAddress: v.optional(v.string()),
	role: v.union(v.literal("reader"), v.literal("writer"), v.literal("commenter"))
});
