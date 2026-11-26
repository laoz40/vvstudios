"use node";

import { ok, safeTry } from "neverthrow";
import { v } from "convex/values";
import { tupleErr, tupleOk, type Result } from "#/lib/result";
import { action } from "#convex/_generated/server";
import {
	lockEditForEmail,
	recordDeliverablesEmailResult,
	sendClientDeliverablesEmail,
	type SendDeliverablesError
} from "#convex/editor/services/deliverablesEmail";
import { emailAdminsForEditReview } from "#convex/editor/services/deliverablesReviewReadyEmail";
import { loadSessionForSessionWideDelivery } from "#convex/editor/services/loadSessionForDeliverables";

export const sendSessionDeliverablesEmail = action({
	args: { bookingId: v.id("bookings"), editorNotes: v.optional(v.string()) },
	handler: (ctx, args): Promise<Result<null, SendDeliverablesError>> =>
		safeTry(async function* () {
			const session = yield* loadSessionForSessionWideDelivery(ctx, args.bookingId);

			// The old session-wide flow treats a completed session as already delivered.
			if (session.editStatus === "completed") {
				return ok(null);
			}

			return ok(yield* sendClientDeliverablesEmail(ctx, session, args.editorNotes));
		}).match(tupleOk, tupleErr)
});

const sendEditArgs = {
	bookingId: v.id("bookings"),
	editId: v.id("edits"),
	notes: v.optional(v.string())
};

export const sendEditToClient = action({
	args: sendEditArgs,
	handler: (ctx, { bookingId, editId, notes }): Promise<Result<null, SendDeliverablesError>> =>
		safeTry(async function* () {
			const { session, editLabel, lock, idempotencyKey } = yield* lockEditForEmail(
				ctx,
				{ bookingId, editId },
				"client"
			);

			const sendResult = await sendClientDeliverablesEmail(ctx, session, notes, {
				label: editLabel,
				idempotencyKey
			});

			yield* recordDeliverablesEmailResult(ctx, lock, sendResult);

			return sendResult;
		}).match(tupleOk, tupleErr)
});

export const sendEditForStudioReview = action({
	args: sendEditArgs,
	handler: (ctx, { bookingId, editId, notes }): Promise<Result<null, SendDeliverablesError>> =>
		safeTry(async function* () {
			const { session, editLabel, editorName, lock, idempotencyKey } = yield* lockEditForEmail(
				ctx,
				{ bookingId, editId },
				"admin_review"
			);

			const sendResult = await emailAdminsForEditReview(ctx, session._id, {
				clientName: session.name,
				editLabel,
				editorName,
				editorNotes: notes,
				idempotencyKey,
				sessionDate: session.date
			});

			yield* recordDeliverablesEmailResult(ctx, lock, sendResult);

			return sendResult;
		}).match(tupleOk, tupleErr)
});
