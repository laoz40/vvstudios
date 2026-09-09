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
	type SessionSortId,
	type SessionSorting
} from "#studio/features/admin/lib/admin-sessions";
import {
	readStoredSessionsTablePreferences,
	storeSessionsTableFilters
} from "#studio/features/admin/lib/admin-dashboard-preferences";
import { InfiniteScrollSentinel } from "#studio/components/InfiniteScrollSentinel";

type SessionsTableProps = {
	activeEditors: ActiveEditor[];
	sessions: SessionRecord[];
	canLoadMoreSessions: boolean;
	isLoadingMoreSessions: boolean;
	isLoadingSessions: boolean;
	loadMoreSessions: () => void;
	onSearchQueryChange: (searchQuery: string) => void;
	onSortingChange: (sorting: SessionSorting) => void;
	searchQuery: string;
	sorting: SessionSorting;
};

export function SessionsTable({
	activeEditors,
	sessions,
	canLoadMoreSessions,
	isLoadingMoreSessions,
	isLoadingSessions,
	loadMoreSessions,
	onSearchQueryChange,
	onSortingChange,
	searchQuery,
	sorting
}: SessionsTableProps) {
	// Table setup and persisted filters
	const initialTablePreferences = useMemo(readStoredSessionsTablePreferences, []);
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

	const editorDisplayNameByToken = useMemo(
		() =>
			new Map(
				activeEditors.map((editor) => [editor.tokenIdentifier, editor.displayName || editor.email])
			),
		[activeEditors]
	);

	// Prefetch another page when client-side filters hide every loaded session.
	useEffect(() => {
		if (
			filteredSessions.length === 0 &&
			canLoadMoreSessions &&
			!isLoadingSessions &&
			!isLoadingMoreSessions
		) {
			loadMoreSessions();
		}
	}, [
		filteredSessions.length,
		canLoadMoreSessions,
		isLoadingSessions,
		isLoadingMoreSessions,
		loadMoreSessions
	]);

	function updateSorting(id: SessionSortId) {
		const currentSort = sorting.at(0);

		if (currentSort?.id === id) {
			onSortingChange([{ id, desc: !currentSort.desc }]);
		} else {
			onSortingChange([{ id, desc: false }]);
		}

		window.scrollTo({ top: 0 });
	}

	function renderSortButton(label: string, id: SessionSortId) {
		const activeSort = sorting.at(0);
		const isActiveSortColumn = activeSort?.id === id;

		return (
			<SortHeaderButton
				label={label}
				isActive={isActiveSortColumn}
				isDescending={activeSort?.desc ?? false}
				isLoading={isLoadingSessions && isActiveSortColumn}
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
				onSearchQueryChange={onSearchQueryChange}
				onShowArchivedChange={setShowArchived}
				onShowStaleSessionsChange={setShowStaleSessions}
				onShowUpcomingOnlyChange={setShowUpcomingOnly}
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
							<TableHead>Customer</TableHead>
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
						{filteredSessions.length > 0 ? (
							filteredSessions.map((session) => (
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
			/>

			<InfiniteScrollSentinel
				canLoadMore={!isLoadingSessions && canLoadMoreSessions}
				isLoadingMore={isLoadingMoreSessions}
				onLoadMore={loadMoreSessions}
			/>
		</section>
	);
}
