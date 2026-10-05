import { paginationOptsValidator } from "convex/server";
import { ConvexError, v } from "convex/values";
import { err, errAsync, ok, ResultAsync } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import {
	detectDeliverablesCustomerType as detectCustomerType,
	detectDeliverablesCustomerType as resolveDeliverablesCustomerType
} from "#convex/lib/editor/editorSessions";
import { loadSessionForDeliverables } from "#convex/services/editor/loadSessionForDeliverables";
import { internalMutation, internalQuery, mutation, query } from "#convex/_generated/server";
import { setBookingArchived } from "#convex/lib/archiveState";
import { updateSessionEditorAssignment } from "#convex/lib/editor/editorAssignments";
import {
	requireDeliverablesEligibility,
	requireDeliverablesOwnership,
	saveSessionAdminNotes,
	saveSessionEditorNotes
} from "#convex/lib/editor/editorSessions";
import {
	buildActiveEditorProjection,
	listActiveEditorProfiles
} from "#convex/lib/editor/editorAssignments";
import {
	buildEditorSessionProjection,
	isEditorVisibleSession
} from "#convex/lib/editor/editorSessions";
import { getEditorSessionDriveFolders } from "#convex/lib/drive/driveStatus";
import { getDriveStatus as loadDriveStatusForBooking } from "#convex/lib/drive/driveStatus";
import { okOrThrow } from "#convex/lib/result";
import { archiveDeadCheckoutBooking } from "#convex/lib/sessions/sessionArchive";
import { getSessionByStripeSessionId, getSessionFromDb } from "#convex/lib/sessions/sessionLookup";
import { requirePermission } from "#convex/services/auth";
import { runArchivePastDeadCheckoutBatch } from "#convex/services/sessions/sessionArchiveWorkflow";
import { writeSessionEditStatusWithHostNotification } from "#convex/services/sessions/sessionDeliverablesWorkflow";
import {
	buildPublicSessionStatusResponse,
	listSessionsService,
	requireConfirmedBookingSession,
	writeSessionInstagramHandle
} from "#convex/services/sessions/sessions";

export const detectDeliverablesCustomerType = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		const session = await ctx.db.get("bookings", args.bookingId);

		if (session === null) {
			return tupleErr({ reason: "BOOKING_NOT_FOUND" as const });
		}

		return detectCustomerType(ctx, session).match(tupleOk, tupleErr);
	}
});

export const getSessionById = internalQuery({
	args: { bookingId: v.id("bookings") },
	handler: async (ctx, args) => {
		return await ctx.db.get("bookings", args.bookingId);
	}
});

export const getDriveStatus = query({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		requirePermission(ctx, "view:sensitive-booking-data")
			.andThen(() => loadDriveStatusForBooking(ctx, args.bookingId))
			.match(tupleOk, tupleErr)
});

export const getDeliverablesCustomerType = query({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		loadSessionForDeliverables(ctx, args.bookingId)
			.andThen((session) => resolveDeliverablesCustomerType(ctx, session))
			.match(tupleOk, tupleErr)
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
	handler: (ctx) =>
		requirePermission(ctx, "assign:session-editor")
			.andThen(() => listActiveEditorProfiles(ctx))
			.andThen((editors) =>
				ResultAsync.combine(editors.map((editor) => buildActiveEditorProjection(ctx, editor)))
			)
			.match(
				(editors) => editors,
				(error) => {
					throw new ConvexError(error);
				}
			)
});

export const listEditorSessions = query({
	args: { paginationOpts: paginationOptsValidator },
	// Paginated queries must return Convex's native page shape, so authorization errors throw.
	handler: (ctx, args) =>
		requirePermission(ctx, "view:sessions")
			.andThen((identity) =>
				okOrThrow(
					ctx.db
						.query("bookings")
						.withIndex("by_assignedEditorTokenIdentifier_and_driveClientId", (indexQuery) =>
							indexQuery.eq("assignedEditorTokenIdentifier", identity.tokenIdentifier)
						)
						.order("desc")
						.paginate(args.paginationOpts)
				)
			)
			.andThen((bookingsPage) => {
				const visibleSessions = bookingsPage.page.filter(isEditorVisibleSession);

				return ResultAsync.combine(
					visibleSessions.map((session) =>
						ResultAsync.fromPromise(getEditorSessionDriveFolders(ctx, session), () => null).map(
							(driveFolders) => buildEditorSessionProjection(session, driveFolders)
						)
					)
				).map((page) => ({ ...bookingsPage, page }));
			})
			.match(
				(sessionsPage) => sessionsPage,
				(error) => {
					throw new ConvexError(error);
				}
			)
});

export const getPublicRescheduleCompleteSession = query({
	args: { bookingId: v.string() },
	handler: (ctx, args) => {
		const bookingId = ctx.db.normalizeId("bookings", args.bookingId);

		if (bookingId === null) {
			return errAsync({ reason: "BOOKING_NOT_FOUND" as const }).match(tupleOk, tupleErr);
		}

		return okOrThrow(ctx.db.get("bookings", bookingId))
			.andThen((session) => {
				if (!session) {
					return err({ reason: "BOOKING_NOT_FOUND" as const });
				}

				return ok(buildPublicSessionStatusResponse(session));
			})
			.match(tupleOk, tupleErr);
	}
});

export const getSessionStatusByStripeSessionId = query({
	args: { stripeSessionId: v.string() },
	handler: async (ctx, args) => {
		const session = await ctx.db
			.query("bookings")
			.withIndex("by_stripeSessionId", (indexQuery) =>
				indexQuery.eq("stripeSessionId", args.stripeSessionId)
			)
			.unique();

		if (!session) return null;

		return buildPublicSessionStatusResponse(session);
	}
});

export const saveSessionInstagramHandle = mutation({
	args: { stripeSessionId: v.string(), instagramHandle: v.string() },
	handler: (ctx, args) =>
		getSessionByStripeSessionId(ctx, args.stripeSessionId)
			.andThen(requireConfirmedBookingSession)
			.andThen((session) => writeSessionInstagramHandle(ctx, session, args.instagramHandle))
			.match(tupleOk, tupleErr)
});

export const assignSessionEditor = mutation({
	args: {
		bookingId: v.id("bookings"),
		editorTokenIdentifier: v.union(v.string(), v.null()),
		adminNotes: v.string()
	},
	handler: (ctx, args) =>
		requirePermission(ctx, "assign:session-editor")
			.andThen(() => getSessionFromDb(ctx, args.bookingId))
			.andThen((session) =>
				updateSessionEditorAssignment(ctx, session, args.editorTokenIdentifier, args.adminNotes)
			)
			.match(tupleOk, tupleErr)
});

export const archiveSession = mutation({
	args: { bookingId: v.id("bookings"), archived: v.boolean() },
	handler: (ctx, args) =>
		requirePermission(ctx, "archive:sessions")
			.andThen(() => getSessionFromDb(ctx, args.bookingId))
			.andThen(() => setBookingArchived(ctx, args.bookingId, args.archived))
			.match(tupleOk, tupleErr)
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
	handler: (ctx, args) =>
		requirePermission(ctx, "assign:session-editor")
			.andThen(() => getSessionFromDb(ctx, args.bookingId))
			.andThen((session) => saveSessionAdminNotes(ctx, session, args.adminNotes))
			.match(tupleOk, tupleErr)
});

export const updateSessionNotes = mutation({
	args: { bookingId: v.id("bookings"), editorNotes: v.string() },
	handler: (ctx, args) =>
		requirePermission(ctx, "update:deliverables")
			.andThen((identity) =>
				getSessionFromDb(ctx, args.bookingId).map((session) => ({ identity, session }))
			)
			.andThen(requireDeliverablesOwnership)
			.andThen(({ session }) => saveSessionEditorNotes(ctx, session, args.editorNotes))
			.match(tupleOk, tupleErr)
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
	handler: (ctx, args) =>
		requirePermission(ctx, "update:deliverables")
			.andThen((identity) =>
				getSessionFromDb(ctx, args.bookingId).map((session) => ({ identity, session }))
			)
			.andThen(requireDeliverablesOwnership)
			.andThen((access) => requireDeliverablesEligibility(access).map(() => access))
			.andThen((access) => writeSessionEditStatusWithHostNotification(ctx, access, args.editStatus))
			.match(tupleOk, tupleErr)
});

export const markSessionCalendarEventDeleted = internalMutation({
	args: { bookingId: v.id("bookings") },
	handler: (ctx, args) =>
		getSessionFromDb(ctx, args.bookingId)
			.andThen(() =>
				archiveDeadCheckoutBooking(ctx, args.bookingId, {
					bookingFailureCode: undefined,
					googleCalendarId: undefined,
					googleEventId: undefined,
					status: "cancelled"
				})
			)
			.match(tupleOk, tupleErr)
});
