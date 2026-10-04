import { v } from "convex/values";

export const sessionReservationValidator = v.object({
	reservedAt: v.number(),
	sessionStartAt: v.number(),
	duration: v.string()
});

export type SessionReservation = { reservedAt: number; sessionStartAt: number; duration: string };
