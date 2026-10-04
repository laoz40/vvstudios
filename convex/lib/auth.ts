import type { UserIdentity } from "convex/server";
import { err, ok } from "neverthrow";
import { z } from "zod";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	editorProfileDisplayName,
	patchBookingsAssignedEditorDisplayName
} from "#convex/lib/editor/editorAssignments";
import { okOrThrow } from "#convex/lib/result";

export const ADMIN_ROLE = "admin";

type PublicMetadata = { role?: string };

const publicMetadataSchema = z.object({ role: z.string().optional() });

function getPublicMetadata(identity: UserIdentity): PublicMetadata | null {
	const parsedMetadata = publicMetadataSchema.safeParse(identity.publicMetadata);

	return parsedMetadata.success ? parsedMetadata.data : null;
}

export function isAdminIdentity(identity: UserIdentity): boolean {
	return getPublicMetadata(identity)?.role === ADMIN_ROLE;
}

export function requireAdminIdentity(identity: UserIdentity) {
	if (!isAdminIdentity(identity)) {
		return err({ reason: "NOT_AUTHORIZED" as const });
	}

	return ok(identity);
}

export function requireEnrollableEditorProfile(editor: Doc<"editorProfiles"> | null) {
	if (editor !== null && !editor.isActive) {
		return err({ reason: "EDITOR_PROFILE_INACTIVE" as const });
	}

	return ok(editor);
}

function requireAuthenticatedIdentity(identity: UserIdentity | null) {
	if (identity === null) {
		return err({ reason: "NOT_AUTHENTICATED" as const });
	}

	return ok(identity);
}

export function requireUser(ctx: Pick<QueryCtx, "auth">) {
	return okOrThrow(ctx.auth.getUserIdentity()).andThen(requireAuthenticatedIdentity);
}

export function getEditorByToken(
	ctx: QueryCtx | MutationCtx,
	token: UserIdentity["tokenIdentifier"]
) {
	return okOrThrow(
		ctx.db
			.query("editorProfiles")
			.withIndex("by_tokenIdentifier", (query) => query.eq("tokenIdentifier", token))
			.unique()
	);
}

export function saveEditorDetails(
	ctx: MutationCtx,
	identity: UserIdentity,
	editor: Doc<"editorProfiles"> | null
) {
	const details = { displayName: identity.name ?? "", email: identity.email ?? "" };

	if (editor !== null) {
		return okOrThrow(
			(async () => {
				const nextAssignedEditorDisplayName = editorProfileDisplayName(details);
				const previousAssignedEditorDisplayName = editorProfileDisplayName(editor);

				await ctx.db.patch("editorProfiles", editor._id, details);

				if (nextAssignedEditorDisplayName !== previousAssignedEditorDisplayName) {
					await patchBookingsAssignedEditorDisplayName(
						ctx,
						editor.tokenIdentifier,
						nextAssignedEditorDisplayName
					);
				}

				return null;
			})()
		);
	}

	return okOrThrow(
		ctx.db
			.insert("editorProfiles", {
				...details,
				tokenIdentifier: identity.tokenIdentifier,
				// Authentication is invite-only, so a newly authenticated user is an approved editor.
				isActive: true,
				lastAssignedAt: null,
				totalEdits: 0
			})
			.then(() => null)
	);
}
