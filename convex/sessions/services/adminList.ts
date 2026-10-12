import { ok, safeTry } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import { requirePermission } from "#convex/shared/services/auth";
import { listAdminSessions, type AdminSessionsView } from "#convex/shared/lib/listAdminSessions";
import {
	buildPublicSessionStatusResponse as buildPublicSessionStatusResponseFromLib,
	buildInstagramSearchBlobPatch,
	patchSessionInstagramHandle
} from "#convex/sessions/lib/adminList";

type PaginationArgs = { paginationOpts: { numItems: number; cursor: string | null } };

type SessionListSortBy = "session" | "createdAt";

type SessionListSortDirection = "asc" | "desc";

type ListSessionsArgs = PaginationArgs & {
	sortBy?: SessionListSortBy;
	sortDirection?: SessionListSortDirection;
	view?: AdminSessionsView;
	includeStale?: boolean;
	searchQuery?: string;
};

export function buildPublicSessionStatusResponse(session: Doc<"bookings">) {
	return buildPublicSessionStatusResponseFromLib(session);
}

export function listSessionsService(ctx: QueryCtx, args: ListSessionsArgs) {
	return requirePermission(ctx, "view:sensitive-booking-data").map(() =>
		listAdminSessions(ctx, args)
	);
}

export function writeSessionInstagramHandle(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	instagramHandle: string
) {
	return safeTry(async function* () {
		const searchBlobPatch = yield* buildInstagramSearchBlobPatch(ctx, session, instagramHandle);

		return ok(yield* patchSessionInstagramHandle(ctx, session, instagramHandle, searchBlobPatch));
	});
}
