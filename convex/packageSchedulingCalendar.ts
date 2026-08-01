"use node";

import { v } from "convex/values";
import { err as tupleErr, ok as tupleOk, type Result } from "#/lib/result";
import { DURATION_OPTIONS, SERVICES } from "#studio/features/booking-form/lib/booking-form-model";
import { action, internalAction, type ActionCtx } from "./_generated/server";
import type { SessionCalendarEventRecord } from "./lib/sessionCalendarEvents";
import {
	deletePackageSessionCalendarEventService,
	getPackageBusyWindowsService,
	savePackageSessionCalendarEventService,
	type PackageCalendarWriteError
} from "./services/packageSchedulingCalendar";

const packageCalendarBookingValidator = v.object({
	date: v.string(),
	duration: v.string(),
	email: v.string(),
	googleCalendarId: v.optional(v.string()),
	googleEventId: v.optional(v.string()),
	name: v.string(),
	time: v.string()
});

const packageCalendarDetailsValidator = v.object({
	addons: v.array(v.string()),
	date: v.string(),
	duration: v.union(...DURATION_OPTIONS.map((duration) => v.literal(duration))),
	email: v.string(),
	eventBufferMinutes: v.number(),
	name: v.string(),
	service: v.union(...SERVICES.map((service) => v.literal(service))),
	time: v.string()
});

type GetPackageBusyWindowsArgs = { rateLimitKey: string; token: string };

export const getPackageBusyWindows = action({
	args: { token: v.string(), rateLimitKey: v.string() },
	handler: (ctx, args) => getPackageBusyWindowsHandler(ctx, args)
});

async function getPackageBusyWindowsHandler(ctx: ActionCtx, args: GetPackageBusyWindowsArgs) {
	return await getPackageBusyWindowsService(ctx, args).match(tupleOk, tupleErr);
}

export type GetPackageBusyWindowsResult = Awaited<ReturnType<typeof getPackageBusyWindowsHandler>>;

export const createPackageSessionCalendarEvent = internalAction({
	args: {
		session: v.union(v.null(), packageCalendarBookingValidator),
		details: packageCalendarDetailsValidator
	},
	handler: (_ctx, args) => savePackageSessionCalendarEventHandler(args)
});

async function savePackageSessionCalendarEventHandler(args: {
	session: SessionCalendarEventRecord | null;
	details: Parameters<typeof savePackageSessionCalendarEventService>[0]["details"];
}): Promise<
	Result<{ googleCalendarId?: string; googleEventId?: string }, PackageCalendarWriteError>
> {
	return await savePackageSessionCalendarEventService(args).match(tupleOk, tupleErr);
}

export const updatePackageSessionCalendarEvent = internalAction({
	args: { session: packageCalendarBookingValidator, details: packageCalendarDetailsValidator },
	handler: (_ctx, args) => savePackageSessionCalendarEventHandler(args)
});

type DeletePackageSessionCalendarEventArgs = { session: SessionCalendarEventRecord };

export const deletePackageSessionCalendarEvent = internalAction({
	args: { session: packageCalendarBookingValidator },
	handler: (ctx, args) => deletePackageSessionCalendarEventHandler(ctx, args)
});

async function deletePackageSessionCalendarEventHandler(
	_ctx: ActionCtx,
	args: DeletePackageSessionCalendarEventArgs
) {
	return await deletePackageSessionCalendarEventService(args.session).match(tupleOk, tupleErr);
}
