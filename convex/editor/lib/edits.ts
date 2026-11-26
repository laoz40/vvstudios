import { okAsync, ResultAsync } from "neverthrow";
import type { Doc, Id } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	getEditingAddonQuantity,
	QUANTITY_TRACKED_ADDONS
} from "#/domain/booking/addon-quantities";
import { getCustomerAddonDisplayLabel } from "#/domain/booking/catalog";
import { okOrThrow } from "#convex/shared/lib/result";
import { isEditorVisibleSession } from "#convex/editor/lib/editorSessions";
import { getEditorEditDueAt, getSydneyDateValue } from "#studio/lib/bookingdatetime";

export function listEdits(ctx: QueryCtx, bookingId: Id<"bookings">) {
	return okOrThrow(
		ctx.db
			.query("edits")
			.withIndex("by_bookingId", (q) => q.eq("bookingId", bookingId))
			.collect()
	);
}

export function loadSessionEditSummaries(ctx: QueryCtx, session: Doc<"bookings">) {
	if (session.editStatusScope !== "edit") return okAsync(undefined);

	return listEdits(ctx, session._id).map((edits) =>
		edits.map(({ _id, label, status }) => ({ _id, label, status }))
	);
}

export function planLegacyEdits(session: Doc<"bookings">) {
	if (
		session.editStatusScope === "edit" ||
		session.assignedEditorTokenIdentifier === undefined ||
		session.editStatus === "completed" ||
		!isEditorVisibleSession(session)
	) {
		return { edits: [], patch: undefined };
	}

	const edits = purchasedEdits(session);

	if (edits.length === 0) return { edits, patch: undefined };

	return {
		edits,
		patch: {
			editStatusScope: "edit",
			editDeliveryMode: "studio_review_only",
			editStatus: "to_edit",
			editorDueDate:
				session.editorDueDate ??
				getSydneyDateValue(new Date(getEditorEditDueAt(session.sessionStartAt)))
		}
	} as const;
}

export function planEditingForAssignment(session: Doc<"bookings">, assigning: boolean) {
	const legacy = planLegacyEdits(session);

	if (legacy.patch !== undefined) return { edits: legacy.edits, ...legacy.patch };

	if (
		session.editStatusScope === "edit" ||
		session.editStatus === "completed" ||
		session.assignedEditorTokenIdentifier !== undefined ||
		!assigning
	) {
		return { editStatusScope: session.editStatusScope, edits: [] };
	}

	const edits = purchasedEdits(session);

	return { editStatusScope: edits.length > 0 ? "edit" : "session", edits } as const;
}

function purchasedEdits(session: Doc<"bookings">) {
	return QUANTITY_TRACKED_ADDONS.filter((addOn) => session.addons.includes(addOn)).flatMap(
		(addOn) => {
			const quantity = getEditingAddonQuantity(addOn, session, 1);
			const name = getCustomerAddonDisplayLabel(addOn);

			return Array.from({ length: quantity }, (_, index) => ({
				bookingId: session._id,
				addOn,
				addOnItemNumber: index + 1,
				label: quantity > 1 ? `${name} (Episode ${index + 1})` : name,
				status: "not_started" as const
			}));
		}
	);
}

export function insertEdits(
	ctx: MutationCtx,
	edits: ReadonlyArray<Omit<Doc<"edits">, "_id" | "_creationTime">>
) {
	return ResultAsync.combine(edits.map((edit) => okOrThrow(ctx.db.insert("edits", edit))));
}

export function getSessionStatusFromEdits(edits: ReadonlyArray<Pick<Doc<"edits">, "status">>) {
	if (edits.every((edit) => edit.status === "not_started")) return "to_edit";

	if (edits.every((edit) => edit.status === "sent")) return "completed";

	return "editing";
}
