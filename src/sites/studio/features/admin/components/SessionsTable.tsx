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
import { SessionTableRow } from "#studio/features/admin/components/SessionTableRow";
import { SessionsTableFilters } from "#studio/features/admin/components/SessionsTableFilters";
import { SessionsTableFooter } from "#studio/features/admin/components/SessionsTableFooter";
import type { BookingRecord } from "#studio/features/admin/lib/admin-bookings";
import {
	filterAdminSessionBookings,
	sortAdminSessionBookings,
	type SessionSortId
} from "#studio/features/admin/lib/admin-sessions";
import {
	readStoredSessionsTablePreferences,
	storeSessionsTableFilters
} from "#studio/features/admin/lib/admin-dashboard-preferences";

type SessionsTableProps = {
	bookings: BookingRecord[];
	canLoadMoreBookings: boolean;
	isLoadingMoreBookings: boolean;
	loadMoreBookings: () => void;
	onSearchQueryChange: (searchQuery: string) => void;
	searchQuery: string;
};

const pageSize = 10;

export function SessionsTable({
	bookings,
	canLoadMoreBookings,
	isLoadingMoreBookings,
	loadMoreBookings,
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
	const [showStaleBookings, setShowStaleBookings] = useState(
		initialTablePreferences.showStaleBookings
	);

	// Persist table preferences.
	useEffect(() => {
		storeSessionsTableFilters({ sorting, showArchived, showStaleBookings, showUpcomingOnly });
	}, [sorting, showArchived, showStaleBookings, showUpcomingOnly]);

	// Visible booking rows after dashboard-level filters.
	const filteredBookings = useMemo(() => {
		return filterAdminSessionBookings(bookings, {
			searchQuery,
			showArchived,
			showStaleBookings,
			showUpcomingOnly
		});
	}, [bookings, searchQuery, showArchived, showStaleBookings, showUpcomingOnly]);

	const sortedBookings = useMemo(() => {
		return sortAdminSessionBookings(filteredBookings, sorting);
	}, [filteredBookings, sorting]);

	const pageCount = Math.max(1, Math.ceil(sortedBookings.length / pageSize));

	const paginatedBookings = sortedBookings.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

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
			const currentSort = currentSorting[0];

			if (currentSort?.id === id) {
				return [{ id, desc: !currentSort.desc }];
			}

			return [{ id, desc: false }];
		});
	}

	function renderSortButton(label: string, id: SessionSortId) {
		const activeSort = sorting[0];

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
				showStaleBookings={showStaleBookings}
				showUpcomingOnly={showUpcomingOnly}
				onSearchQueryChange={(value) => applyTableControlChange(onSearchQueryChange, value)}
				onShowArchivedChange={(value) => applyTableControlChange(setShowArchived, value)}
				onShowStaleBookingsChange={(value) => applyTableControlChange(setShowStaleBookings, value)}
				onShowUpcomingOnlyChange={(value) => applyTableControlChange(setShowUpcomingOnly, value)}
			/>

			<div className="overflow-x-auto border-y">
				<Table className="w-full min-w-7xl table-fixed">
					<TableHeader>
						<TableRow>
							<TableHead className="w-16 md:w-8 text-center">Status</TableHead>
							<TableHead className="w-36">{renderSortButton("Customer", "name")}</TableHead>
							<TableHead className="w-28 md:w-16">
								{renderSortButton("Session", "session")}
							</TableHead>
							<TableHead className="w-44">Service</TableHead>
							<TableHead className="w-56 md:w-36">Contact</TableHead>
							<TableHead className="w-16 text-center">Package</TableHead>
							<TableHead className="w-48">Notes</TableHead>
							<TableHead className="w-16 md:w-12 text-center">Amount</TableHead>
							<TableHead className="w-24 md:w-16 text-center">Deliverables</TableHead>
							<TableHead className="w-28 md:w-16">
								{renderSortButton("Created", "createdAt")}
							</TableHead>
							<TableHead className="w-12 md:w-6" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{paginatedBookings.length > 0 ? (
							paginatedBookings.map((booking) => (
								<SessionTableRow
									key={booking._id}
									booking={booking}
									onPackageFilterClick={onSearchQueryChange}
								/>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={11}
									className="h-24 text-center text-muted-foreground">
									No bookings yet. L business.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<SessionsTableFooter
				filteredBookingsCount={filteredBookings.length}
				totalBookingsCount={bookings.length}
				canLoadMoreBookings={canLoadMoreBookings}
				isLoadingMoreBookings={isLoadingMoreBookings}
				pageIndex={pageIndex}
				pageCount={pageCount}
				onLoadMoreBookings={loadMoreBookings}
				onPreviousPage={() => setPageIndex((currentPageIndex) => Math.max(0, currentPageIndex - 1))}
				onNextPage={() =>
					setPageIndex((currentPageIndex) => Math.min(pageCount - 1, currentPageIndex + 1))
				}
			/>
		</section>
	);
}
