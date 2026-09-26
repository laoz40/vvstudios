import type { Doc } from "#convex/_generated/dataModel";
import { sessionConsumesPackageCapacity } from "#convex/lib/packageSessionCapacity";
import {
	DURATION_OPTIONS,
	type BookingFormValues
} from "#studio/features/booking-form/lib/booking-form-model";

export type SessionRecord = Doc<"bookings"> & {
	assignedEditorDisplayName?: string;
	hasDriveWorkflowFailure?: boolean;
	packageInvoiceNumber?: string;
	linkedPackageSize?: 4 | 8 | 12;
	packageSessionPosition?: number;
	packageStripeCustomerId?: string;
	stripeInvoicesSummary?: { paymentStatus: "paid" | "unpaid"; totalAmount: number } | null;
};

export function toAdminSessionDuration(
	duration: string | undefined
): BookingFormValues["duration"] {
	return DURATION_OPTIONS.find((option) => option === duration) ?? "";
}

function isCapacityConsumingPackageSession(session: SessionRecord) {
	return session.packageId !== undefined && sessionConsumesPackageCapacity(session);
}

export type SessionActionDetails = {
	canGenerateRescheduleLink: boolean;
	customerSessionId: string;
	canManageConfirmedSession: boolean;
	isPastSession: boolean;
};

export function isManageableConfirmedSession(session: SessionRecord) {
	return session.status === "confirmed" || session.status === "email_failed";
}

export function getPackageSessionProgressLabel(session: SessionRecord) {
	if (!session.packageId) {
		return null;
	}

	if (
		!isCapacityConsumingPackageSession(session) ||
		!session.linkedPackageSize ||
		!session.packageSessionPosition
	) {
		return "Package";
	}

	return `${session.packageSessionPosition}/${session.linkedPackageSize}`;
}

export type SessionSortId = "session" | "createdAt";

export type SessionSorting = { id: SessionSortId; desc: boolean }[];

export type SessionListSortDirection = "asc" | "desc";

export type SessionListQuerySort = {
	sortBy: SessionSortId;
	sortDirection: SessionListSortDirection;
};

export type AdminSessionsView = "inbox" | "all";

export function toSessionListQuerySort(sorting: SessionSorting): SessionListQuerySort {
	const activeSort = sorting.at(0) ?? { id: "session", desc: false };

	return { sortBy: activeSort.id, sortDirection: activeSort.desc ? "desc" : "asc" };
}

type SessionArchiveConfirmInput = Pick<
	SessionRecord,
	"assignedEditorTokenIdentifier" | "editStatus"
>;

/** Warn before archiving when an editor still has open deliverables work. */
export function shouldConfirmSessionArchive(session: SessionArchiveConfirmInput): boolean {
	if (session.assignedEditorTokenIdentifier === undefined) {
		return false;
	}

	return session.editStatus !== "completed";
}
