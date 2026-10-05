import { ConvexError } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { tupleErr, tupleOk } from "#/lib/result";
import { loadDeliverablesCustomerTypeForBooking } from "#convex/services/editor/loadSessionForDeliverables";
import { internalMutation, internalQuery, mutation, query } from "#convex/_generated/server";
import { requirePermission } from "#convex/services/auth";
import { runArchivePastDeadCheckoutBatch } from "#convex/services/sessions/sessionArchive";
import { listSessionsService } from "#convex/services/sessions/sessions";
import {
	listActiveEditorsForAdmin,
	listEditorSessionsForAssignee
} from "#convex/services/sessions/sessionsEditor";
import {
	assignSessionEditorFromAdmin,
	archiveSessionFromAdmin,
	cancelSessionAfterCalendarEventDeleted,
	saveSessionInstagramHandleByStripeSessionId,
	writeSessionAdminNotesFromAdmin,
	writeSessionEditStatusFromEditor,
	writeSessionEditorNotesFromEditor
} from "#convex/services/sessions/sessionMutations";
import {
	loadBookingRowForInternal,
	loadInternalDeliverablesCustomerType,
	loadPublicRescheduleCompleteSession,
	loadSensitiveBookingDriveStatus,
	loadSessionStatusByStripeSessionId
} from "#convex/services/sessions/sessionQueries";

export const detectDeliverablesCustomerType = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		loadInternalDeliverablesCustomerType(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const getSessionById = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) =>
		(await loadBookingRowForInternal(ctx, args.bookingId)).match(
			(session) => session,
			() => null
		)
});

export const getDriveStatus = query({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		requirePermission(ctx, "view:sensitive-booking-data")
			.andThen(() => loadSensitiveBookingDriveStatus(ctx, args.bookingId))
			.match(tupleOk, tupleErr)
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
	handler: (ctx, args) => listSessionsService(ctx, args)
});

export const listActiveEditors = query({
	args: {},
	handler: async (ctx) =>
		(await listActiveEditorsForAdmin(ctx)).match(
			(editors) => editors,
			(authError) => {
				throw new ConvexError(authError);
			}
		)
});

export const listEditorSessions = query({
	args: { paginationOpts: paginationOptsValidator },
	handler: async (ctx, args) =>
		(await listEditorSessionsForAssignee(ctx, args.paginationOpts)).match(
			(sessionsPage) => sessionsPage,
			(authError) => {
				throw new ConvexError(authError);
			}
		)
});

export const getPublicRescheduleCompleteSession = query({
	args: { bookingId: v.string() },
	handler: async (ctx, args) =>
		await loadPublicRescheduleCompleteSession(ctx, args.bookingId).match(tupleOk, tupleErr)
});

export const getSessionStatusByStripeSessionId = query({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) =>
		(await loadSessionStatusByStripeSessionId(ctx, args.stripeSessionId)).match(
			(status) => status,
			() => null
		)
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
		adminNotes: v.string()
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
		requirePermission(ctx, "archive:sessions")
			.andThen(() => runArchivePastDeadCheckoutBatch(ctx, args.cursor, args.numItems))
			.match(tupleOk, tupleErr)
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
