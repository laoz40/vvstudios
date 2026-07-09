import { useEffect, useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { api } from "#convex/_generated/api";
import type { CleanupOldPendingAndExpiredBookingsResult } from "#convex/bookings";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "#/components/ui/table";
import { tryCatch } from "#/lib/result";
import { CleanupOldBookingsDialog } from "#studio/features/admin/components/CleanupOldBookingsDialog";
import { SortHeaderButton } from "#studio/features/admin/components/AdminDashboardTableUtils";
import { SessionTableRow } from "#studio/features/admin/components/SessionTableRow";
import { SessionsTableFilters } from "#studio/features/admin/components/SessionsTableFilters";
import { SessionsTableFooter } from "#studio/features/admin/components/SessionsTableFooter";
import {
	isStaleCleanupBooking,
	type BookingRecord
} from "#studio/features/admin/lib/admin-bookings";
import {
	filterAdminSessionBookings,
	getStaleCleanupBookingCounts,
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

const pageSize = 12;

export function SessionsTable({
	bookings,
	canLoadMoreBookings,
	isLoadingMoreBookings,
	loadMoreBookings,
	onSearchQueryChange,
	searchQuery
}: SessionsTableProps) {
	const cleanupOldBookings = useMutation(api.bookings.cleanupOldPendingAndExpiredBookings);

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

	// Cleanup dialog state
	const [isCleanupDialogOpen, setIsCleanupDialogOpen] = useState(false);
	const [isCleaningUp, setIsCleaningUp] = useState(false);

	// Cleanup candidates
	const staleCleanupBookings = useMemo(
		() => bookings.filter((booking) => isStaleCleanupBooking(booking)),
		[bookings]
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

	// Reset pagination when visible rows change.
	useEffect(() => {
		setPageIndex(0);
	}, [
		bookings,
		searchQuery,
		showArchived,
		showStaleBookings,
		showUpcomingOnly,
		sortedBookings.length
	]);
	const paginatedBookings = sortedBookings.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

	const staleCounts = useMemo(
		() => getStaleCleanupBookingCounts(staleCleanupBookings),
		[staleCleanupBookings]
	);

	function updateSorting(id: SessionSortId) {
		setSorting((currentSorting) => {
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

	async function handleCleanupOldBookings() {
		setIsCleaningUp(true);

		const [error, result] = await tryCatch<CleanupOldPendingAndExpiredBookingsResult>(
			cleanupOldBookings({})
		);

		if (error !== null) {
			switch (error.reason) {
				case "NOT_AUTHENTICATED":
					toast.error("You are not signed in.");
					break;

				case "NOT_AUTHORIZED":
					toast.error("You do not have access to clean up bookings.");
					break;

				case "BOOKING_CLEANUP_FAILED":
					toast.error("Unable to clean up old bookings.");
					break;

				case "UNEXPECTED_ERROR":
					toast.error("Something went wrong while cleaning up old bookings.");
					break;

				default: {
					const _exhaustive: never = error;
					return _exhaustive;
				}
			}

			setIsCleaningUp(false);
			return;
		}

		setIsCleanupDialogOpen(false);
		toast.success(
			result.deletedCount === 1
				? "Deleted 1 unconfirmed booking."
				: `Deleted ${result.deletedCount} unconfirmed bookings.`
		);
		setIsCleaningUp(false);
	}

	return (
		<section className="flex flex-col gap-4">
			<SessionsTableFilters
				searchQuery={searchQuery}
				showArchived={showArchived}
				showStaleBookings={showStaleBookings}
				showUpcomingOnly={showUpcomingOnly}
				onSearchQueryChange={onSearchQueryChange}
				onShowArchivedChange={setShowArchived}
				onShowStaleBookingsChange={setShowStaleBookings}
				onShowUpcomingOnlyChange={setShowUpcomingOnly}
			/>

			<div className="overflow-x-auto border-y">
				<Table className="min-w-6xl table-fixed">
					<TableHeader>
						<TableRow>
							<TableHead className="w-36">{renderSortButton("Customer", "name")}</TableHead>
							<TableHead className="w-24 md:w-16 text-center">Status</TableHead>
							<TableHead className="w-28 md:w-16">
								{renderSortButton("Session", "session")}
							</TableHead>
							<TableHead className="w-44">Service</TableHead>
							<TableHead className="w-56 md:w-36">Contact</TableHead>
							<TableHead className="w-12 text-center">Package</TableHead>
							<TableHead className="w-56">Notes</TableHead>
							<TableHead className="w-16 md:w-12 text-center">Due</TableHead>
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
				staleCleanupBookingsCount={staleCleanupBookings.length}
				isCleaningUp={isCleaningUp}
				canLoadMoreBookings={canLoadMoreBookings}
				isLoadingMoreBookings={isLoadingMoreBookings}
				pageIndex={pageIndex}
				pageCount={pageCount}
				onCleanupClick={() => setIsCleanupDialogOpen(true)}
				onLoadMoreBookings={loadMoreBookings}
				onPreviousPage={() => setPageIndex((currentPageIndex) => Math.max(0, currentPageIndex - 1))}
				onNextPage={() =>
					setPageIndex((currentPageIndex) => Math.min(pageCount - 1, currentPageIndex + 1))
				}
			/>

			<CleanupOldBookingsDialog
				open={isCleanupDialogOpen}
				onOpenChange={setIsCleanupDialogOpen}
				isCleaningUp={isCleaningUp}
				staleCleanupBookingsCount={staleCleanupBookings.length}
				staleCounts={staleCounts}
				onConfirm={() => void handleCleanupOldBookings()}
			/>
		</section>
	);
}
