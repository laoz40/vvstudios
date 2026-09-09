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
import { PackageTableRow } from "#studio/features/admin/components/PackageTableRow";
import { PackagesTableFilters } from "#studio/features/admin/components/PackagesTableFilters";
import {
	filterAdminPackages,
	mapPackageToAdminRow,
	type AdminPackageFilters,
	type AdminPackageRecord,
	type AdminPackageSort
} from "#studio/features/admin/lib/admin-packages";
import {
	readStoredPackageTableFilters,
	storePackageTableFilters
} from "#studio/features/admin/lib/admin-dashboard-preferences";
import { InfiniteScrollSentinel } from "#studio/components/InfiniteScrollSentinel";

type PackageCheckboxFilterKey = Exclude<keyof AdminPackageFilters, "searchQuery">;

export function PackagesTable({
	canLoadMorePackages,
	isLoadingMorePackages,
	isLoadingPackages,
	loadMorePackages,
	onSortingChange,
	onViewPackageSessions,
	packages,
	sorting
}: {
	canLoadMorePackages: boolean;
	isLoadingMorePackages: boolean;
	isLoadingPackages: boolean;
	loadMorePackages: () => void;
	onSortingChange: (sorting: AdminPackageSort) => void;
	onViewPackageSessions: (invoiceNumber: string) => void;
	packages: AdminPackageRecord[];
	sorting: AdminPackageSort;
}) {
	// Package filters
	const [filters, setFilters] = useState<AdminPackageFilters>(() => {
		return readStoredPackageTableFilters();
	});
	const { showArchived, showOverdue, showPaid, showUpcoming } = filters;

	// Persist package filters.
	useEffect(() => {
		storePackageTableFilters({
			showArchived,
			showOverdue,
			showPaid,
			showUpcoming,
			searchQuery: ""
		});
	}, [showArchived, showOverdue, showPaid, showUpcoming]);

	// Visible package rows after dashboard-level filters.
	const visiblePackages = useMemo(() => {
		return filterAdminPackages(packages.map(mapPackageToAdminRow), filters);
	}, [filters, packages]);

	function updateCreatedSort() {
		onSortingChange({ isDescending: !sorting.isDescending });
		window.scrollTo({ top: 0 });
	}

	function updateFilter(key: PackageCheckboxFilterKey, checked: boolean) {
		setFilters((currentFilters) => {
			if (key === "showOverdue" && checked) {
				return { ...currentFilters, showOverdue: true, showUpcoming: false };
			}

			if (key === "showUpcoming" && checked) {
				return { ...currentFilters, showOverdue: false, showUpcoming: true };
			}

			return { ...currentFilters, [key]: checked };
		});
	}

	function updateSearchQuery(searchQuery: string) {
		setFilters((currentFilters) => ({ ...currentFilters, searchQuery }));
	}

	return (
		<section className="flex flex-col gap-4">
			<PackagesTableFilters
				filters={filters}
				onFilterChange={updateFilter}
				onSearchQueryChange={updateSearchQuery}
			/>

			<div className="overflow-x-auto border-y">
				<Table className="w-full min-w-7xl table-fixed">
					<colgroup>
						<col className="w-8 md:w-6" />
						<col className="w-42 md:w-36" />
						<col className="w-20 md:w-16" />
						<col className="w-36 md:w-28" />
						<col className="w-48" />
						<col className="w-16 md:w-12" />
						<col className="w-20 md:w-8" />
						<col className="w-20 md:w-12" />
						<col className="w-6" />
					</colgroup>
					<TableHeader>
						<TableRow>
							<TableHead className="text-center">Status</TableHead>
							<TableHead>Customer</TableHead>
							<TableHead>Package</TableHead>
							<TableHead>Add-ons (Fixed)</TableHead>
							<TableHead>Contact</TableHead>
							<TableHead>Due / Expiry</TableHead>
							<TableHead className="text-right">Amount</TableHead>
							<TableHead>
								<SortHeaderButton
									label="Created"
									isActive
									isDescending={sorting.isDescending}
									isLoading={isLoadingPackages}
									onClick={updateCreatedSort}
								/>
							</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{visiblePackages.length > 0 ? (
							visiblePackages.map((packageRow) => (
								<PackageTableRow
									key={packageRow.id}
									onViewPackageSessions={onViewPackageSessions}
									packageRow={packageRow}
								/>
							))
						) : (
							<TableRow>
								<TableCell
									colSpan={9}
									className="h-24 text-center text-muted-foreground">
									No packages. L business.
								</TableCell>
							</TableRow>
						)}
					</TableBody>
				</Table>
			</div>

			<InfiniteScrollSentinel
				canLoadMore={!isLoadingPackages && canLoadMorePackages}
				isLoadingMore={isLoadingMorePackages}
				onLoadMore={loadMorePackages}
			/>
		</section>
	);
}
