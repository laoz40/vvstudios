import type { UserIdentity } from "convex/server";
import { err, ok, okAsync } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { isAdminIdentity } from "#convex/lib/auth";
import { okOrThrow } from "#convex/lib/result";

export type DeliverablesEligibilitySession = Pick<
	Doc<"bookings">,
	"status" | "sessionStartAt" | "assignedEditorTokenIdentifier"
>;

export type DeliverablesSessionAccess<
	T extends DeliverablesEligibilitySession = DeliverablesEligibilitySession
> = { identity: UserIdentity; session: T };

export type DeliverablesCustomerType = "first-time" | "recurring";

export function detectDeliverablesCustomerType(ctx: QueryCtx, session: Doc<"bookings">) {
	return okOrThrow(
		ctx.db
			.query("bookings")
			.withIndex("by_email", (query) => query.eq("email", session.email))
			.collect()
	).map((priorSessions) => {
		const hasCompletedPriorSession = priorSessions.some(
			(priorSession) => priorSession._id !== session._id && priorSession.editStatus === "completed"
		);

		return hasCompletedPriorSession ? "recurring" : "first-time";
	});
}

export function isEditorVisibleSession(session: Doc<"bookings">): boolean {
	// Admin archive must not hide work from editors.
	return session.status === "confirmed" || session.status === "email_failed";
}

export function requireDeliverablesOwnership<T extends DeliverablesEligibilitySession>(
	access: DeliverablesSessionAccess<T>
) {
	if (
		!isAdminIdentity(access.identity) &&
		access.session.assignedEditorTokenIdentifier !== access.identity.tokenIdentifier
	) {
		return err({ reason: "SESSION_NOT_ASSIGNED_TO_EDITOR" as const });
	}

	return ok(access);
}

export function requireDeliverablesEligibility<T extends DeliverablesEligibilitySession>(
	access: DeliverablesSessionAccess<T>
) {
	const { session } = access;

	if (session.status !== "confirmed" && session.status !== "email_failed") {
		return err({ reason: "SESSION_NOT_CONFIRMED" as const });
	}

	if (session.sessionStartAt >= Date.now()) {
		return err({ reason: "SESSION_NOT_IN_PAST" as const });
	}

	return ok(access.session);
}

export function saveSessionEditorNotes(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editorNotes: string
) {
	return okOrThrow(
		ctx.db
			.patch("bookings", session._id, { editorNotes: editorNotes.trim() || undefined })
			.then(() => null)
	);
}

export function saveSessionAdminNotes(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	adminNotes: string
) {
	return okOrThrow(
		ctx.db
			.patch("bookings", session._id, { adminNotes: adminNotes.trim() || undefined })
			.then(() => null)
	);
}

export function saveSessionEditStatus(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	editStatus: "to_edit" | "editing" | "review" | "completed"
) {
	const editorTokenIdentifier = session.assignedEditorTokenIdentifier;

	// Credit each transition into Completed. A duplicate credit requires an unlikely manual
	// Completed → Editing → Completed cycle, so we avoid adding persistent tracking for it.
	const shouldIncrementTotal =
		editStatus === "completed" &&
		session.editStatus !== "completed" &&
		editorTokenIdentifier !== undefined;

	const patchBookingEditStatus = () =>
		okOrThrow(ctx.db.patch("bookings", session._id, { editStatus }).then(() => null));

	if (!shouldIncrementTotal) {
		return patchBookingEditStatus();
	}

	return okOrThrow(
		ctx.db
			.query("editorProfiles")
			.withIndex("by_tokenIdentifier", (query) =>
				query.eq("tokenIdentifier", editorTokenIdentifier)
			)
			.unique()
	).andThen((editor) =>
		patchBookingEditStatus().andThen(() => {
			if (editor === null) {
				return okAsync(null);
			}

			return okOrThrow(
				ctx.db
					.patch("editorProfiles", editor._id, { totalEdits: editor.totalEdits + 1 })
					.then(() => null)
			);
		})
	);
}

export function buildEditorSessionProjection(
	session: Doc<"bookings">,
	driveFolders: {
		assets: { id: string; url: string };
		deliverables: { id: string; url: string };
		rawMedia: { id: string; url: string };
		session: { id: string; url: string };
		sessionFolderName: string;
	} | null
) {
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
		completeEditQuantity: session.completeEditQuantity,
		clipsPackageQuantity: session.clipsPackageQuantity,
		handcraftedClipsQuantity: session.handcraftedClipsQuantity,
		editStatus: session.editStatus,
		driveFolders
	};
}
