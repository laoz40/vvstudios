import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { ok, safeTry } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import { loadDeliverablesCustomerTypeForBooking } from "#convex/editor/services/loadSessionForDeliverables";
import { internalMutation, internalQuery, mutation, query } from "#convex/_generated/server";
import { requirePermission } from "#convex/shared/services/auth";
import { runArchivePastDeadCheckoutBatch } from "#convex/sessions/services/archive";
import { listSessionsService } from "#convex/sessions/services/adminList";
import {
	listActiveEditorsForAdmin,
	listEditorSessionsForAssignee
} from "#convex/sessions/services/editor";
import {
	assignSessionEditorFromAdmin,
	archiveSessionFromAdmin,
	cancelSessionAfterCalendarEventDeleted,
	saveSessionInstagramHandleByStripeSessionId,
	writeSessionAdminNotesFromAdmin,
	writeSessionEditStatusFromEditor,
	writeSessionEditorNotesFromEditor
} from "#convex/sessions/services/mutations";
import {
	loadBookingRowOrNull,
	loadInternalDeliverablesCustomerType,
	loadPublicRescheduleCompleteSession,
	loadSensitiveBookingDriveStatus,
	loadSessionStatusByStripeSessionId
} from "#convex/sessions/services/queries";

export const detectDeliverablesCustomerType = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		loadInternalDeliverablesCustomerType(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const getSessionById = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) => loadBookingRowOrNull(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const getDriveStatus = query({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		loadSensitiveBookingDriveStatus(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const getDeliverablesCustomerType = query({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		loadDeliverablesCustomerTypeForBooking(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const listSessions = query({
	args: {
		paginationOpts: paginationOptsValidator,
		sortBy: v.optional(v.union(v.literal("session"), v.literal("createdAt"))),
		sortDirection: v.optional(v.union(v.literal("asc"), v.literal("desc"))),
		view: v.optional(v.union(v.literal("inbox"), v.literal("all"))),
		includeStale: v.optional(v.boolean()),
		searchQuery: v.optional(v.string())
	},
	handler: async (ctx, args) => {
		const result = await listSessionsService(ctx, args);

		if (result.isErr()) throw new ConvexError(result.error);

		return result.value;
	}
});

export const listActiveEditors = query({
	args: {},
	handler: (ctx) => listActiveEditorsForAdmin(ctx).match(tupleOk, tupleErr)
});

export const listEditorSessions = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) => {
		const result = await listEditorSessionsForAssignee(ctx, args.paginationOpts);

		if (result.isErr()) throw new ConvexError(result.error);

		return result.value;
	}
});

export const getPublicRescheduleCompleteSession = query({
	args: { bookingId: v.string() },
	handler: async (ctx, args) =>
		await loadPublicRescheduleCompleteSession(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const getSessionStatusByStripeSessionId = query({
	args: { stripeSessionId: v.string() },
	handler: (ctx, args) =>
		loadSessionStatusByStripeSessionId(ctx, args.stripeSessionId).match(tupleOk, tupleErr)
});

export const saveSessionInstagramHandle = mutation({
	args: { stripeSessionId: v.string(), instagramHandle: v.string() },
	handler: (ctx, args) =>
		saveSessionInstagramHandleByStripeSessionId(ctx, args).match(tupleOk, tupleErr)
});

export const assignSessionEditor = mutation({
	args: {
		bookingId: v.id("bookings"),
		editorTokenIdentifier: v.union(v.string(), v.null()),
		adminNotes: v.string(),
		editorDueDate: v.optional(v.string())
	},
	handler: (ctx, args) => assignSessionEditorFromAdmin(ctx, args).match(tupleOk, tupleErr)
});

export const archiveSession = mutation({
	args: { bookingId: v.id("bookings"), archived: v.boolean() },
	handler: (ctx, args) => archiveSessionFromAdmin(ctx, args).match(tupleOk, tupleErr)
});

export const archivePastDeadCheckoutSessions = mutation({
	args: { cursor: v.union(v.string(), v.null()), numItems: v.optional(v.number()) },
	handler: (ctx, args) =>
		safeTry(async function* () {
			yield* requirePermission(ctx, "archive:sessions");

			const archivedSessions = yield* runArchivePastDeadCheckoutBatch(
				ctx,
				args.cursor,
				args.numItems
			);

			return ok(archivedSessions);
		}).match(tupleOk, tupleErr)
});

export const updateSessionAdminNotes = mutation({
	args: { bookingId: v.id("bookings"), adminNotes: v.string() },
	handler: (ctx, args) => writeSessionAdminNotesFromAdmin(ctx, args).match(tupleOk, tupleErr)
});

export const updateSessionNotes = mutation({
	args: { bookingId: v.id("bookings"), editorNotes: v.string() },
	handler: (ctx, args) => writeSessionEditorNotesFromEditor(ctx, args).match(tupleOk, tupleErr)
});

export const updateSessionEditStatus = mutation({
	args: {
		bookingId: v.id("bookings"),
		editStatus: v.union(
			v.literal("to_edit"),
			v.literal("editing"),
			v.literal("review"),
			v.literal("completed")
		)
	},
	handler: (ctx, args) => writeSessionEditStatusFromEditor(ctx, args).match(tupleOk, tupleErr)
});

export const markSessionCalendarEventDeleted = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		cancelSessionAfterCalendarEventDeleted(ctx, args.bookingId).match(tupleOk, tupleErr)
});
