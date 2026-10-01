import type { AdminPackageSort } from "#studio/features/admin/lib/admin-packages";
import type { SessionSorting } from "#studio/features/admin/lib/admin-sessions";

function compareSortableNumbers(left: number, right: number, isDescending: boolean) {
	if (left === right) {
		return 0;
	}

	if (isDescending) {
		return right - left;
	}

	return left - right;
}

type AdminSearchSessionSortRow = { pendingPaymentCreatedAt: number; sessionStartAt: number };

export function sortAdminSearchSessions<T extends AdminSearchSessionSortRow>(
	sessions: T[],
	sorting: SessionSorting
): T[] {
	if (sessions.length <= 1) {
		return sessions;
	}

	const activeSort = sorting.at(0) ?? { id: "session", desc: false };

	const sortKey =
		activeSort.id === "createdAt" ? "pendingPaymentCreatedAt" : ("sessionStartAt" as const);

	return sessions.toSorted((left, right) =>
		compareSortableNumbers(left[sortKey], right[sortKey], activeSort.desc)
	);
}

type AdminSearchPackageSortRow = { createdAt: number };

export function sortAdminSearchPackages<T extends AdminSearchPackageSortRow>(
	packages: T[],
	sorting: AdminPackageSort
): T[] {
	if (packages.length <= 1) {
		return packages;
	}

	return packages.toSorted((left, right) =>
		compareSortableNumbers(left.createdAt, right.createdAt, sorting.isDescending)
	);
}
