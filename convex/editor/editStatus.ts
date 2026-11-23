import { v } from "convex/values";
import { ok, safeTry } from "neverthrow";
import { tupleErr, tupleOk } from "#/lib/result";
import { internalMutation, mutation } from "#convex/_generated/server";
import {
	loadAssignedEdit,
	authorizeAndLockDeliverablesEmail,
	saveEditingStatus,
	saveEditDeliverablesEmailResult,
	updateSessionStatusFromEdits
} from "#convex/editor/services/editDelivery";
import { getSessionFromDb } from "#convex/sessions/services/lookup";
import { editWorkStatusValidator } from "#convex/schema";

const editIdentity = { bookingId: v.id("bookings"), editId: v.id("edits") };

const emailRecipient = v.union(v.literal("client"), v.literal("admin_review"));

export const updateEditStatus = mutation({
	args: { ...editIdentity, status: editWorkStatusValidator },
	handler: (ctx, args) =>
		safeTry(async function* () {
			const { session, edit } = yield* loadAssignedEdit(ctx, args, "update:deliverables");
			yield* saveEditingStatus(ctx, edit, args.status);

			return ok(yield* updateSessionStatusFromEdits(ctx, session));
		}).match(tupleOk, tupleErr)
});

export const lockEditForDeliverablesEmail = internalMutation({
	args: { ...editIdentity, recipient: emailRecipient, lockId: v.string() },
	handler: (ctx, args) =>
		safeTry(async function* () {
			const access = yield* loadAssignedEdit(
				ctx,
				args,
				args.recipient === "client" ? "send:deliverables-email" : "update:deliverables"
			);

			const editorName = yield* authorizeAndLockDeliverablesEmail(ctx, access, args);

			return ok({ session: access.session, editLabel: access.edit.label, editorName });
		}).match(tupleOk, tupleErr)
});

export const recordDeliverablesEmailResult = internalMutation({
	args: {
		...editIdentity,
		recipient: emailRecipient,
		lockId: v.string(),
		outcome: v.union(
			v.object({ kind: v.literal("sent"), sentAt: v.number() }),
			v.object({ kind: v.literal("failed") })
		)
	},
	handler: (ctx, args) =>
		safeTry(async function* () {
			const session = yield* getSessionFromDb(ctx, args.bookingId);
			yield* saveEditDeliverablesEmailResult(ctx, session, args);

			if (args.outcome.kind === "sent") {
				yield* updateSessionStatusFromEdits(ctx, session);
			}

			return ok(null);
		}).match(tupleOk, tupleErr)
});
