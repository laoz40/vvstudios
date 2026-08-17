import type { UserIdentity } from "convex/server";
import { err, ok } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { isAdminIdentity } from "#convex/lib/auth";
import { parseGoogleDriveLink } from "#convex/lib/googleDriveLinks";
import { okOrThrow } from "#convex/lib/result";

export type DeliverablesSessionAccess = { identity: UserIdentity; session: Doc<"bookings"> };
export type DeliverablesCustomerType = "first-time" | "recurring";

export function detectDeliverablesCustomerType(ctx: QueryCtx, session: Doc<"bookings">) {
	return okOrThrow(
		(async (): Promise<DeliverablesCustomerType> => {
			for await (const priorSession of ctx.db
				.query("bookings")
				.withIndex("by_email", (query) => query.eq("email", session.email))) {
				if (priorSession._id !== session._id && priorSession.editStatus === "completed") {
					return "recurring";
				}
			}

			return "first-time";
		})()
	);
}

export function isEditorVisibleSession(session: Doc<"bookings">): boolean {
	const hasEligibleStatus = session.status === "confirmed" || session.status === "email_failed";
	return hasEligibleStatus && session.hiddenAt === undefined;
}

export function requireDeliverablesOwnership(access: DeliverablesSessionAccess) {
	if (
		!isAdminIdentity(access.identity) &&
		access.session.assignedEditorTokenIdentifier !== access.identity.tokenIdentifier
	) {
		return err({ reason: "SESSION_NOT_ASSIGNED_TO_EDITOR" as const });
	}

	return ok(access);
}

export function requireDeliverablesEligibility(access: DeliverablesSessionAccess) {
	const { session } = access;
	if (session.status !== "confirmed" && session.status !== "email_failed") {
		return err({ reason: "SESSION_NOT_CONFIRMED" as const });
	}

	if (session.hiddenAt !== undefined) {
		return err({ reason: "SESSION_ARCHIVED" as const });
	}

	if (session.sessionStartAt >= Date.now()) {
		return err({ reason: "SESSION_NOT_IN_PAST" as const });
	}

	return ok(session);
}

function getAssignedEditor(ctx: MutationCtx, editorTokenIdentifier: string) {
	return ctx.db
		.query("editorProfiles")
		.withIndex("by_tokenIdentifier", (query) => query.eq("tokenIdentifier", editorTokenIdentifier))
		.unique();
}

export function saveSessionEditorNotes(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editorNotes: string
) {
	return okOrThrow(
		ctx.db.patch(session._id, { editorNotes: editorNotes.trim() || undefined }).then(() => null)
	);
}

export function saveSessionAdminNotes(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	adminNotes: string
) {
	return okOrThrow(
		ctx.db.patch(session._id, { adminNotes: adminNotes.trim() || undefined }).then(() => null)
	);
}

export function saveSessionReview(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	driveLink: string,
	clientNotes: string
) {
	const parsedDriveLink = parseGoogleDriveLink(driveLink);
	if (parsedDriveLink === null) {
		return err({ reason: "INVALID_DRIVE_LINK" as const });
	}

	return okOrThrow(
		ctx.db
			.patch(session._id, {
				deliverablesDriveLink: parsedDriveLink,
				deliverablesClientNotes: clientNotes.trim() || undefined,
				editStatus: "review"
			})
			.then(() => null)
	);
}

export function saveSessionEditStatus(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editStatus: "to_edit" | "editing" | "review" | "completed"
) {
	return okOrThrow(
		(async () => {
			const editorTokenIdentifier = session.assignedEditorTokenIdentifier;
			// Credit each transition into Completed. A duplicate credit requires an unlikely manual
			// Completed → Editing → Completed cycle, so we avoid adding persistent tracking for it.
			const shouldIncrementTotal =
				editStatus === "completed" &&
				session.editStatus !== "completed" &&
				editorTokenIdentifier !== undefined;

			if (!shouldIncrementTotal) {
				await ctx.db.patch(session._id, { editStatus });
				return null;
			}

			const editor = await getAssignedEditor(ctx, editorTokenIdentifier);
			await ctx.db.patch(session._id, { editStatus });
			if (editor !== null) {
				await ctx.db.patch(editor._id, { totalEdits: editor.totalEdits + 1 });
			}
			return null;
		})()
	);
}

export function buildEditorSessionProjection(session: Doc<"bookings">) {
	return {
		_id: session._id,
		name: session.name,
		accountName: session.accountName,
		notes: session.notes,
		adminNotes: session.adminNotes,
		editorNotes: session.editorNotes,
		deliverablesClientNotes: session.deliverablesClientNotes,
		deliverablesDriveLink: session.deliverablesDriveLink,
		date: session.date,
		time: session.time,
		duration: session.duration,
		service: session.service,
		addons: session.addons,
		essentialEditQuantity: session.essentialEditQuantity,
		clipsPackageQuantity: session.clipsPackageQuantity,
		editStatus: session.editStatus
	};
}
