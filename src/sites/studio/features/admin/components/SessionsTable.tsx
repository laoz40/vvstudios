import { useEffect, useMemo, useState } from "react";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "#/components/ui/table";
import { SortHeaderButton } from "#studio/features/admin/components/AdminDashboardTableUtils";
import type { ActiveEditor } from "#studio/features/admin/components/SessionEditorAssignment";
import { SessionTableRow } from "#studio/features/admin/components/SessionTableRow";
import { SessionsTableFilters } from "#studio/features/admin/components/SessionsTableFilters";
import { SessionsTableFooter } from "#studio/features/admin/components/SessionsTableFooter";
import type { SessionRecord } from "#studio/features/admin/lib/admin-sessions";
import {
	filterAdminSessions,
	sortAdminSessions,
	type SessionSortId
} from "#studio/features/admin/lib/admin-sessions";
import {
	readStoredSessionsTablePreferences,
	storeSessionsTableFilters
} from "#studio/features/admin/lib/admin-dashboard-preferences";

type SessionsTableProps = {
	activeEditors: ActiveEditor[];
	sessions: SessionRecord[];
	canLoadMoreSessions: boolean;
	isLoadingMoreSessions: boolean;
	loadMoreSessions: () => void;
	onSearchQueryChange: (searchQuery: string) => void;
	searchQuery: string;
};

const pageSize = 10;

export function SessionsTable({
	activeEditors,
	sessions,
	canLoadMoreSessions,
	isLoadingMoreSessions,
	loadMoreSessions,
	onSearchQueryChange,
	searchQuery
}: SessionsTableProps) {
	// Table setup and persisted filters
	const initialTablePreferences = useMemo(readStoredSessionsTablePreferences, []);
	const [sorting, setSorting] = useState(initialTablePreferences.sorting);
	const [pageIndex, setPageIndex] = useState(0);
	const [showArchived, setShowArchived] = useState(initialTablePreferences.showArchived);
	const [showUpcomingOnly, setShowUpcomingOnly] = useState(
		initialTablePreferences.showUpcomingOnly
	);
	const [showStaleSessions, setShowStaleSessions] = useState(
		initialTablePreferences.showStaleBookings
	);

	// Persist table preferences.
	useEffect(() => {
		storeSessionsTableFilters({
			sorting,
			showArchived,
			showStaleBookings: showStaleSessions,
			showUpcomingOnly
		});
	}, [sorting, showArchived, showStaleSessions, showUpcomingOnly]);

	// Visible session rows after dashboard-level filters.
	const filteredSessions = useMemo(() => {
		return filterAdminSessions(sessions, {
			searchQuery,
			showArchived,
			showStaleSessions,
			showUpcomingOnly
		});
	}, [sessions, searchQuery, showArchived, showStaleSessions, showUpcomingOnly]);

	const sortedSessions = useMemo(() => {
		return sortAdminSessions(filteredSessions, sorting);
	}, [filteredSessions, sorting]);

	const editorDisplayNameByToken = useMemo(
		() =>
			new Map(
				activeEditors.map((editor) => [editor.tokenIdentifier, editor.displayName || editor.email])
			),
		[activeEditors]
	);

	const pageCount = Math.max(1, Math.ceil(sortedSessions.length / pageSize));

	const paginatedSessions = sortedSessions.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

	// Reset pagination when another dashboard view changes the controlled search.
	useEffect(() => {
		setPageIndex(0);
	}, [searchQuery]);

	function applyTableControlChange<T>(onChange: (value: T) => void, value: T) {
		setPageIndex(0);
		onChange(value);
	}

	function updateSorting(id: SessionSortId) {
		applyTableControlChange(setSorting, (currentSorting) => {
			const currentSort = currentSorting.at(0);

			if (currentSort?.id === id) {
				return [{ id, desc: !currentSort.desc }];
			}

			return [{ id, desc: false }];
		});
	}

	function renderSortButton(label: string, id: SessionSortId) {
		const activeSort = sorting.at(0);

		return (
			<SortHeaderButton
				label={label}
				isActive={activeSort?.id === id}
				isDescending={activeSort?.desc ?? false}
				onClick={() => updateSorting(id)}
			/>
		);
	}

	return (
		<section className="flex flex-col gap-4">
			<SessionsTableFilters
				searchQuery={searchQuery}
				showArchived={showArchived}
				showStaleSessions={showStaleSessions}
				showUpcomingOnly={showUpcomingOnly}
				onSearchQueryChange={(value) => applyTableControlChange(onSearchQueryChange, value)}
				onShowArchivedChange={(value) => applyTableControlChange(setShowArchived, value)}
				onShowStaleSessionsChange={(value) => applyTableControlChange(setShowStaleSessions, value)}
				onShowUpcomingOnlyChange={(value) => applyTableControlChange(setShowUpcomingOnly, value)}
			/>

			<div className="overflow-x-auto border-y">
				<Table className="w-full min-w-7xl table-fixed">
					<colgroup>
						<col className="w-12 md:w-8" />
						<col className="w-56 md:w-36" />
						<col className="w-24 md:w-16" />
						<col className="w-56 md:w-32" />
						<col className="w-56 md:w-40" />
						<col className="w-16" />
						<col className="w-86 md:w-56" />
						<col className="w-16 md:w-8" />
						<col className="w-24 md:w-16" />
						<col className="w-24 md:w-16" />
						<col className="w-6" />
					</colgroup>
					<TableHeader>
						<TableRow>
							<TableHead className="text-center">Status</TableHead>
							<TableHead>{renderSortButton("Customer", "name")}</TableHead>
							<TableHead>{renderSortButton("Session", "session")}</TableHead>
							<TableHead>Service</TableHead>
							<TableHead>Contact</TableHead>
							<TableHead className="text-center">Package</TableHead>
							<TableHead>Notes</TableHead>
							<TableHead className="text-center">Amount</TableHead>
							<TableHead className="text-center">Deliverables</TableHead>
							<TableHead>{renderSortButton("Created", "createdAt")}</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{paginatedSessions.length > 0 ? (
							paginatedSessions.map((session) => (
								<SessionTableRow
									key={session._id}
									activeEditors={activeEditors}
									assignedEditorDisplayName={
										session.assignedEditorTokenIdentifier
											? (editorDisplayNameByToken.get(session.assignedEditorTokenIdentifier) ??
												null)
											: null
									}
									session={session}
									onPackageFilterClick={onSearchQueryChange}
								/>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={11}
									className="h-24 text-center text-muted-foreground">
									No sessions yet. L business.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<SessionsTableFooter
				filteredSessionsCount={filteredSessions.length}
				totalSessionsCount={sessions.length}
				canLoadMoreSessions={canLoadMoreSessions}
				isLoadingMoreSessions={isLoadingMoreSessions}
				pageIndex={pageIndex}
				pageCount={pageCount}
				onLoadMoreSessions={loadMoreSessions}
				onPreviousPage={() => setPageIndex((currentPageIndex) => Math.max(0, currentPageIndex - 1))}
				onNextPage={() =>
					setPageIndex((currentPageIndex) => Math.min(pageCount - 1, currentPageIndex + 1))
				}
			/>
		</section>
	);
}
