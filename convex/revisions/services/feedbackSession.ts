import { ok, ResultAsync, safeTry } from "neverthrow";
import type { Doc } from "#convex/_generated/dataModel";
import type { MutationCtx, QueryCtx } from "#convex/_generated/server";
import {
	loadBookingRow,
	loadDriveClientRow,
	loadDriveSessionRowByBookingId
} from "#convex/drive/lib/driveBookingDriveClient";
import { listEdits } from "#convex/editor/lib/edits";
import {
	createFeedbackLinkIfMissing,
	listSessionRevisionRounds,
	loadFeedbackLinkByToken,
	loadFeedbackLinkForEligibleEdit
} from "#convex/revisions/lib/feedbackLinks";
import {
	buildFeedbackSessionView,
	requireEligibleFeedbackSession,
	requireFeedbackLink,
	validateFeedbackTokenInput
} from "#convex/revisions/lib/feedbackSessionView";

export function getOrCreateSessionFeedbackToken(
	ctx: MutationCtx,
	session: Doc<"bookings">,
	edit: Doc<"edits">
) {
	return safeTry(async function* () {
		const lookup = yield* loadFeedbackLinkForEligibleEdit(ctx, session, edit);
		const token = yield* createFeedbackLinkIfMissing(ctx, session._id, lookup);

		return ok(token);
	});
}

export function loadEligibleFeedbackSessionByToken(ctx: QueryCtx, token: string) {
	return safeTry(async function* () {
		const validToken = yield* validateFeedbackTokenInput(token);
		const link = yield* loadFeedbackLinkByToken(ctx, validToken);
		const validLink = yield* requireFeedbackLink(link);
		const session = yield* loadBookingRow(ctx, validLink.bookingId);

		return ok(yield* requireEligibleFeedbackSession(session));
	});
}

function loadSessionAssetsFolderUrl(ctx: QueryCtx, session: Doc<"bookings">) {
	return safeTry(async function* () {
		const driveSession = yield* loadDriveSessionRowByBookingId(
			ctx,
			session.driveClientId === undefined ? session._id : null
		);

		const driveClient = yield* loadDriveClientRow(
			ctx,
			session.driveClientId ?? driveSession?.driveClientId ?? null
		);

		return ok(driveClient?.assetsFolder?.url ?? null);
	});
}

export function loadFeedbackSessionView(ctx: QueryCtx, session: Doc<"bookings">, now: number) {
	return safeTry(async function* () {
		const [edits, rounds, assetsFolderUrl] = yield* ResultAsync.combine([
			listEdits(ctx, session._id),
			listSessionRevisionRounds(ctx, session._id),
			loadSessionAssetsFolderUrl(ctx, session)
		]);

		return ok(buildFeedbackSessionView({ session, edits, rounds, assetsFolderUrl, now }));
	});
}
